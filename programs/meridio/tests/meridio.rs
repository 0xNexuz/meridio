//! Meridio program tests (LiteSVM). T1–T13 from the plan:
//! the happy path, every attack we expect, and an invariant fuzz.

use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program,
        },
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    litesvm_token::{
        get_spl_account, spl_token, CreateAssociatedTokenAccount, CreateMint, MintTo,
    },
    meridio::{
        state::{Collection, CollectionStatus, Share, ShareStatus},
        CreateCollectionArgs, COLLECTION_SEED, SHARE_SEED, VAULT_SEED,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const T0: i64 = 1_800_000_000;
const PAY_BY: i64 = T0 + 1_000;
const PICKUP_BY: i64 = T0 + 2_000;
const PRICE: u64 = 18_000_000; // 18 USDC (6 decimals)
const FEE: u64 = 1_000_000; // 1 USDC
const SHARE: u64 = PRICE + FEE;
const START_BALANCE: u64 = 100_000_000;

struct Env {
    svm: LiteSVM,
    org: Keypair,
    vendor: Keypair,
    station: Keypair,
    outsider: Keypair,
    mint: Pubkey,
    org_ata: Pubkey,
    vendor_ata: Pubkey,
    outsider_ata: Pubkey,
    buyers: Vec<Keypair>,
    buyer_atas: Vec<Pubkey>,
    collection: Pubkey,
    vault: Pubkey,
}

fn pid() -> Pubkey {
    meridio::id()
}

fn set_time(svm: &mut LiteSVM, t: i64) {
    let mut c: Clock = svm.get_sysvar();
    c.unix_timestamp = t;
    svm.set_sysvar(&c);
}

/// Send a transaction; on failure return the program logs joined, so tests
/// can assert on the exact error name.
fn send(svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> Result<(), String> {
    let mut signers: Vec<&Keypair> = vec![payer];
    signers.extend_from_slice(extra);
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    let res = svm.send_transaction(tx);
    svm.expire_blockhash();
    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("{:?}\n{}", e.err, e.meta.logs.join("\n"))),
    }
}

fn expect_err(res: Result<(), String>, needle: &str) {
    match res {
        Ok(()) => panic!("expected failure containing {needle:?}, but the transaction succeeded"),
        Err(logs) => assert!(logs.contains(needle), "expected {needle:?} in:\n{logs}"),
    }
}

fn bal(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    get_spl_account::<spl_token::state::Account>(svm, ata).unwrap().amount
}

fn share_pda(collection: &Pubkey, buyer: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[SHARE_SEED, collection.as_ref(), buyer.as_ref()], &pid()).0
}

fn read_collection(env: &Env) -> Collection {
    let acc = env.svm.get_account(&env.collection).unwrap();
    Collection::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

fn read_share(env: &Env, buyer: &Pubkey) -> Option<Share> {
    let acc = env.svm.get_account(&share_pda(&env.collection, buyer))?;
    if acc.data.is_empty() {
        return None;
    }
    Share::try_deserialize(&mut acc.data.as_slice()).ok()
}

fn setup(n_buyers: usize) -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/meridio.so"));
    svm.add_program(pid(), bytes).unwrap();
    set_time(&mut svm, T0);

    let org = Keypair::new();
    let vendor = Keypair::new();
    let station = Keypair::new();
    let outsider = Keypair::new();
    let buyers: Vec<Keypair> = (0..n_buyers).map(|_| Keypair::new()).collect();
    for k in [&org, &vendor, &station, &outsider].into_iter().chain(buyers.iter()) {
        svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
    }

    let mint = CreateMint::new(&mut svm, &org).decimals(6).send().unwrap();
    let mk_ata = |svm: &mut LiteSVM, owner: &Pubkey| {
        CreateAssociatedTokenAccount::new(svm, &org, &mint).owner(owner).send().unwrap()
    };
    let org_ata = mk_ata(&mut svm, &org.pubkey());
    let vendor_ata = mk_ata(&mut svm, &vendor.pubkey());
    let outsider_ata = mk_ata(&mut svm, &outsider.pubkey());
    MintTo::new(&mut svm, &org, &mint, &outsider_ata, START_BALANCE).send().unwrap();
    let mut buyer_atas = vec![];
    for b in &buyers {
        let ata = mk_ata(&mut svm, &b.pubkey());
        MintTo::new(&mut svm, &org, &mint, &ata, START_BALANCE).send().unwrap();
        buyer_atas.push(ata);
    }

    let id: u64 = 7;
    let collection = Pubkey::find_program_address(
        &[COLLECTION_SEED, org.pubkey().as_ref(), &id.to_le_bytes()],
        &pid(),
    )
    .0;
    let vault = Pubkey::find_program_address(&[VAULT_SEED, collection.as_ref()], &pid()).0;

    let mut env = Env {
        svm, org, vendor, station, outsider, mint, org_ata, vendor_ata, outsider_ata,
        buyers, buyer_atas, collection, vault,
    };
    let args = default_args(&env, id);
    let ix = create_ix(&env, args);
    let org = env.org.insecure_clone();
    send(&mut env.svm, &[ix], &org, &[]).unwrap();
    env
}

fn default_args(env: &Env, id: u64) -> CreateCollectionArgs {
    CreateCollectionArgs {
        collection_id: id,
        title: "BIO 201 textbook".to_string(),
        vendor: env.vendor.pubkey(),
        station: env.station.pubkey(),
        unit_price: PRICE,
        fee_per_unit: FEE,
        min_buyers: 2,
        max_units: 40,
        pay_by: PAY_BY,
        pickup_by: PICKUP_BY,
    }
}

fn create_ix(env: &Env, args: CreateCollectionArgs) -> Instruction {
    let collection = Pubkey::find_program_address(
        &[COLLECTION_SEED, env.org.pubkey().as_ref(), &args.collection_id.to_le_bytes()],
        &pid(),
    )
    .0;
    let vault = Pubkey::find_program_address(&[VAULT_SEED, collection.as_ref()], &pid()).0;
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::CreateCollection { args }.data(),
        meridio::accounts::CreateCollection {
            organizer: env.org.pubkey(),
            mint: env.mint,
            collection,
            vault,
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn pay_ix(env: &Env, i: usize) -> Instruction {
    let buyer = env.buyers[i].pubkey();
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::PayShare {}.data(),
        meridio::accounts::PayShare {
            buyer,
            collection: env.collection,
            mint: env.mint,
            vault: env.vault,
            buyer_token: env.buyer_atas[i],
            share: share_pda(&env.collection, &buyer),
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn cancel_share_ix(env: &Env, i: usize) -> Instruction {
    let buyer = env.buyers[i].pubkey();
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::CancelShare {}.data(),
        meridio::accounts::CancelShare {
            buyer,
            collection: env.collection,
            mint: env.mint,
            vault: env.vault,
            buyer_token: env.buyer_atas[i],
            share: share_pda(&env.collection, &buyer),
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

fn lock_ix(env: &Env, caller: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::Lock {}.data(),
        meridio::accounts::Lock { caller: *caller, collection: env.collection }.to_account_metas(None),
    )
}

fn cancel_collection_ix(env: &Env, organizer: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::CancelCollection {}.data(),
        meridio::accounts::CancelCollection { organizer: *organizer, collection: env.collection }
            .to_account_metas(None),
    )
}

fn pickup_ix(env: &Env, buyer: &Pubkey, station: &Pubkey, share: &Pubkey, vendor_token: &Pubkey, organizer_token: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::ConfirmPickup {}.data(),
        meridio::accounts::ConfirmPickup {
            buyer: *buyer,
            station: *station,
            collection: env.collection,
            mint: env.mint,
            vault: env.vault,
            share: *share,
            vendor_token: *vendor_token,
            organizer_token: *organizer_token,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

fn pickup_ok_ix(env: &Env, i: usize) -> Instruction {
    let buyer = env.buyers[i].pubkey();
    pickup_ix(env, &buyer, &env.station.pubkey(), &share_pda(&env.collection, &buyer), &env.vendor_ata, &env.org_ata)
}

fn refund_ix(env: &Env, cranker: &Pubkey, share: &Pubkey, buyer_token: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::RefundShare {}.data(),
        meridio::accounts::RefundShare {
            cranker: *cranker,
            collection: env.collection,
            mint: env.mint,
            vault: env.vault,
            share: *share,
            buyer_token: *buyer_token,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

fn refund_ok_ix(env: &Env, cranker: &Pubkey, i: usize) -> Instruction {
    let buyer = env.buyers[i].pubkey();
    refund_ix(env, cranker, &share_pda(&env.collection, &buyer), &env.buyer_atas[i])
}

fn close_ix(env: &Env) -> Instruction {
    Instruction::new_with_bytes(
        pid(),
        &meridio::instruction::CloseCollection {}.data(),
        meridio::accounts::CloseCollection {
            organizer: env.org.pubkey(),
            collection: env.collection,
            vault: env.vault,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

// Small wrappers so each test reads as the story it tells.
fn pay(env: &mut Env, i: usize) -> Result<(), String> {
    let ix = pay_ix(env, i);
    let b = env.buyers[i].insecure_clone();
    send(&mut env.svm, &[ix], &b, &[])
}
fn lock_by_org(env: &mut Env) -> Result<(), String> {
    let ix = lock_ix(env, &env.org.pubkey());
    let o = env.org.insecure_clone();
    send(&mut env.svm, &[ix], &o, &[])
}
/// Pickup with the station as fee payer, as the real Solana Pay flow does.
fn pickup(env: &mut Env, i: usize) -> Result<(), String> {
    let ix = pickup_ok_ix(env, i);
    let st = env.station.insecure_clone();
    let b = env.buyers[i].insecure_clone();
    send(&mut env.svm, &[ix], &st, &[&b])
}
fn refund_by_outsider(env: &mut Env, i: usize) -> Result<(), String> {
    let ix = refund_ok_ix(env, &env.outsider.pubkey(), i);
    let o = env.outsider.insecure_clone();
    send(&mut env.svm, &[ix], &o, &[])
}

/// Invariant 1: the vault holds exactly the sum of shares still Paid,
/// and that equals paid_count × share amount.
fn check_vault_invariant(env: &Env) {
    let c = read_collection(env);
    let mut sum = 0u64;
    let mut paid = 0u32;
    for b in &env.buyers {
        if let Some(s) = read_share(env, &b.pubkey()) {
            if s.status == ShareStatus::Paid {
                sum += s.amount;
                paid += 1;
            }
        }
    }
    let vault = bal(&env.svm, &env.vault);
    assert_eq!(vault, sum, "vault balance != sum of Paid shares");
    assert_eq!(paid, c.paid_count, "paid_count out of sync");
    assert_eq!(vault, c.paid_count as u64 * SHARE);
}

// ---------------------------------------------------------------- T1

#[test]
fn t1_full_path_pay_lock_pickup_refund_close() {
    let mut env = setup(3);
    for i in 0..3 {
        pay(&mut env, i).unwrap();
    }
    assert_eq!(bal(&env.svm, &env.vault), 3 * SHARE);
    for i in 0..3 {
        assert_eq!(bal(&env.svm, &env.buyer_atas[i]), START_BALANCE - SHARE);
    }
    check_vault_invariant(&env);

    lock_by_org(&mut env).unwrap();
    assert_eq!(read_collection(&env).status, CollectionStatus::Locked);

    pickup(&mut env, 0).unwrap();
    assert_eq!(bal(&env.svm, &env.vendor_ata), PRICE);
    assert_eq!(bal(&env.svm, &env.org_ata), FEE);
    assert_eq!(read_share(&env, &env.buyers[0].pubkey()).unwrap().status, ShareStatus::PickedUp);
    check_vault_invariant(&env);

    set_time(&mut env.svm, PICKUP_BY + 1);
    refund_by_outsider(&mut env, 1).unwrap();
    refund_by_outsider(&mut env, 2).unwrap();
    assert_eq!(bal(&env.svm, &env.buyer_atas[1]), START_BALANCE);
    assert_eq!(bal(&env.svm, &env.buyer_atas[2]), START_BALANCE);
    assert_eq!(bal(&env.svm, &env.vault), 0);
    check_vault_invariant(&env);

    let c = read_collection(&env);
    assert_eq!((c.paid_count, c.picked_count, c.refunded_count), (0, 1, 2));

    let ix = close_ix(&env);
    let o = env.org.insecure_clone();
    send(&mut env.svm, &[ix], &o, &[]).unwrap();
    assert!(env.svm.get_account(&env.collection).map_or(true, |a| a.data.is_empty()));
}

// ---------------------------------------------------------------- T2

#[test]
fn t2_organizer_cannot_take_the_money() {
    let mut env = setup(3);
    for i in 0..3 {
        pay(&mut env, i).unwrap();
    }
    lock_by_org(&mut env).unwrap();
    let org = env.org.insecure_clone();

    // (a) Direct SPL transfer out of the vault, signed by the organiser.
    let steal = spl_token::instruction::transfer(
        &spl_token::ID, &env.vault, &env.org_ata, &org.pubkey(), &[], SHARE,
    )
    .unwrap();
    assert!(send(&mut env.svm, &[steal], &org, &[]).is_err());

    // (b) Pickup with the organiser's own account as "vendor".
    let buyer = env.buyers[0].insecure_clone();
    let st = env.station.insecure_clone();
    let ix = pickup_ix(&env, &buyer.pubkey(), &st.pubkey(), &share_pda(&env.collection, &buyer.pubkey()), &env.org_ata, &env.outsider_ata);
    let res = send(&mut env.svm, &[ix], &st, &[&buyer]);
    expect_err(res.clone(), "vendor_token");
    expect_err(res, "ConstraintRaw");

    // (c) After pickup-by, refund someone's share into the organiser's account.
    set_time(&mut env.svm, PICKUP_BY + 1);
    let ix = refund_ix(&env, &org.pubkey(), &share_pda(&env.collection, &env.buyers[1].pubkey()), &env.org_ata);
    expect_err(send(&mut env.svm, &[ix], &org, &[]), "ConstraintRaw");

    // (d) Organiser cannot pick up a share they never paid for.
    let ix = pickup_ix(&env, &org.pubkey(), &st.pubkey(), &share_pda(&env.collection, &org.pubkey()), &env.vendor_ata, &env.org_ata);
    assert!(send(&mut env.svm, &[ix], &st, &[&org]).is_err());

    assert_eq!(bal(&env.svm, &env.vault), 3 * SHARE);
    assert_eq!(bal(&env.svm, &env.org_ata), 0);
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T3

#[test]
fn t3_pickup_needs_the_real_station_signature() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    lock_by_org(&mut env).unwrap();
    let buyer = env.buyers[0].insecure_clone();

    // Station listed but not signing.
    let mut ix = pickup_ok_ix(&env, 0);
    for m in ix.accounts.iter_mut() {
        if m.pubkey == env.station.pubkey() {
            *m = AccountMeta::new_readonly(m.pubkey, false);
        }
    }
    expect_err(send(&mut env.svm, &[ix], &buyer, &[]), "AccountNotSigner");

    // A different key pretending to be the station.
    let fake = Keypair::new();
    env.svm.airdrop(&fake.pubkey(), 1_000_000_000).unwrap();
    let ix = pickup_ix(&env, &buyer.pubkey(), &fake.pubkey(), &share_pda(&env.collection, &buyer.pubkey()), &env.vendor_ata, &env.org_ata);
    expect_err(send(&mut env.svm, &[ix], &fake, &[&buyer]), "ConstraintHasOne");

    assert_eq!(bal(&env.svm, &env.vendor_ata), 0);
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T4

#[test]
fn t4_buyer_cannot_confirm_someone_elses_share() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    lock_by_org(&mut env).unwrap();
    let a = env.buyers[0].insecure_clone();
    let st = env.station.insecure_clone();
    // Buyer A signs, but points at buyer B's share.
    let b_share = share_pda(&env.collection, &env.buyers[1].pubkey());
    let ix = pickup_ix(&env, &a.pubkey(), &st.pubkey(), &b_share, &env.vendor_ata, &env.org_ata);
    expect_err(send(&mut env.svm, &[ix], &st, &[&a]), "ConstraintSeeds");
    assert_eq!(read_share(&env, &env.buyers[1].pubkey()).unwrap().status, ShareStatus::Paid);
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T5

#[test]
fn t5_no_double_pickup() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    lock_by_org(&mut env).unwrap();
    pickup(&mut env, 0).unwrap();
    expect_err(pickup(&mut env, 0), "ShareNotPaid");
    assert_eq!(bal(&env.svm, &env.vendor_ata), PRICE);
    // And a picked-up share cannot be refunded later.
    set_time(&mut env.svm, PICKUP_BY + 1);
    expect_err(refund_by_outsider(&mut env, 0), "ShareNotPaid");
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T6

#[test]
fn t6_no_pickup_after_deadline() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    lock_by_org(&mut env).unwrap();
    set_time(&mut env.svm, PICKUP_BY + 1);
    expect_err(pickup(&mut env, 0), "PickupByPassed");
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T7

#[test]
fn t7_no_early_refund_while_locked() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    lock_by_org(&mut env).unwrap();
    set_time(&mut env.svm, PAY_BY + 10); // after pay-by, before pickup-by
    expect_err(refund_by_outsider(&mut env, 0), "RefundNotAllowed");
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T8

#[test]
fn t8_stranger_crank_pays_the_buyer_only() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    lock_by_org(&mut env).unwrap();
    set_time(&mut env.svm, PICKUP_BY + 1);
    let out = env.outsider.insecure_clone();
    // Stranger tries to route the refund to themselves.
    let ix = refund_ix(&env, &out.pubkey(), &share_pda(&env.collection, &env.buyers[0].pubkey()), &env.outsider_ata);
    expect_err(send(&mut env.svm, &[ix], &out, &[]), "ConstraintRaw");
    assert_eq!(bal(&env.svm, &env.outsider_ata), START_BALANCE);
    // The honest crank works and pays the buyer.
    refund_by_outsider(&mut env, 0).unwrap();
    assert_eq!(bal(&env.svm, &env.buyer_atas[0]), START_BALANCE);
    assert_eq!(bal(&env.svm, &env.outsider_ata), START_BALANCE);
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T9

#[test]
fn t9_wrong_mint_rejected() {
    let mut env = setup(1);
    let b = env.buyers[0].insecure_clone();
    let fake_mint = CreateMint::new(&mut env.svm, &b).decimals(6).send().unwrap();
    let fake_ata = CreateAssociatedTokenAccount::new(&mut env.svm, &b, &fake_mint).owner(&b.pubkey()).send().unwrap();
    MintTo::new(&mut env.svm, &b, &fake_mint, &fake_ata, START_BALANCE).send().unwrap();

    // Pay with a worthless token account.
    let mut ix = pay_ix(&env, 0);
    for m in ix.accounts.iter_mut() {
        if m.pubkey == env.buyer_atas[0] {
            m.pubkey = fake_ata;
        }
    }
    expect_err(send(&mut env.svm, &[ix], &b, &[]), "ConstraintTokenMint");

    // Or swap the mint account itself.
    let mut ix = pay_ix(&env, 0);
    for m in ix.accounts.iter_mut() {
        if m.pubkey == env.mint {
            m.pubkey = fake_mint;
        }
        if m.pubkey == env.buyer_atas[0] {
            m.pubkey = fake_ata;
        }
    }
    expect_err(send(&mut env.svm, &[ix], &b, &[]), "ConstraintHasOne");
    assert_eq!(bal(&env.svm, &env.vault), 0);
}

// ---------------------------------------------------------------- T10

#[test]
fn t10_not_enough_buyers_means_refunds() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap(); // min_buyers is 2, only 1 pays
    expect_err(lock_by_org(&mut env), "NotEnoughBuyers");
    // Before pay-by: no refund yet (they could still be joined).
    expect_err(refund_by_outsider(&mut env, 0), "RefundNotAllowed");
    set_time(&mut env.svm, PAY_BY + 1);
    // Anyone may try to lock after pay-by, but it still needs enough buyers.
    let out = env.outsider.insecure_clone();
    let ix = lock_ix(&env, &out.pubkey());
    expect_err(send(&mut env.svm, &[ix], &out, &[]), "NotEnoughBuyers");
    refund_by_outsider(&mut env, 0).unwrap();
    assert_eq!(bal(&env.svm, &env.buyer_atas[0]), START_BALANCE);
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T11

#[test]
fn t11_cancel_share_only_while_open() {
    let mut env = setup(3);
    for i in 0..3 {
        pay(&mut env, i).unwrap();
    }
    // Cancelling while open returns the money and frees the share account.
    let ix = cancel_share_ix(&env, 2);
    let b2 = env.buyers[2].insecure_clone();
    send(&mut env.svm, &[ix], &b2, &[]).unwrap();
    assert_eq!(bal(&env.svm, &env.buyer_atas[2]), START_BALANCE);
    assert!(read_share(&env, &b2.pubkey()).is_none());
    check_vault_invariant(&env);

    lock_by_org(&mut env).unwrap();
    let ix = cancel_share_ix(&env, 0);
    let b0 = env.buyers[0].insecure_clone();
    expect_err(send(&mut env.svm, &[ix], &b0, &[]), "NotOpen");
    check_vault_invariant(&env);
}

// ---------------------------------------------------------------- T12

#[test]
fn t12_creation_rules() {
    let mut env = setup(0);
    let org = env.org.insecure_clone();
    let cases: Vec<(Box<dyn Fn(&mut CreateCollectionArgs)>, &str)> = vec![
        (Box::new(|a| a.fee_per_unit = PRICE / 10 + 1), "FeeTooHigh"),
        (Box::new(|a| a.unit_price = 0), "ZeroPrice"),
        (Box::new(|a| a.min_buyers = 0), "BadBuyerLimits"),
        (Box::new(|a| { a.min_buyers = 5; a.max_units = 4; }), "BadBuyerLimits"),
        (Box::new(|a| a.pay_by = T0 - 1), "BadDeadlines"),
        (Box::new(|a| a.pickup_by = PAY_BY), "BadDeadlines"),
        (Box::new(|a| a.title = "x".repeat(65)), "TitleTooLong"),
    ];
    for (n, (mutate, needle)) in cases.into_iter().enumerate() {
        let mut args = default_args(&env, 100 + n as u64);
        mutate(&mut args);
        let ix = create_ix(&env, args);
        expect_err(send(&mut env.svm, &[ix], &org, &[]), needle);
    }
    // Exactly 10% is allowed.
    let mut args = default_args(&env, 200);
    args.fee_per_unit = PRICE / 10;
    let ix = create_ix(&env, args);
    send(&mut env.svm, &[ix], &org, &[]).unwrap();
}

// ------------------------------------------------- extra organiser rules

#[test]
fn only_organizer_locks_early_and_cancels() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    pay(&mut env, 1).unwrap();
    let out = env.outsider.insecure_clone();
    let ix = lock_ix(&env, &out.pubkey());
    expect_err(send(&mut env.svm, &[ix], &out, &[]), "OrganizerOnly");
    let ix = cancel_collection_ix(&env, &out.pubkey());
    expect_err(send(&mut env.svm, &[ix], &out, &[]), "OrganizerOnly");

    // Organiser cancels: everything refundable at once, even before pay-by.
    let org = env.org.insecure_clone();
    let ix = cancel_collection_ix(&env, &org.pubkey());
    send(&mut env.svm, &[ix], &org, &[]).unwrap();
    expect_err(pay(&mut env, 0), "already in use"); // share exists; cannot pay twice
    refund_by_outsider(&mut env, 0).unwrap();
    refund_by_outsider(&mut env, 1).unwrap();
    assert_eq!(bal(&env.svm, &env.vault), 0);
    check_vault_invariant(&env);
}

#[test]
fn close_refused_while_shares_outstanding() {
    let mut env = setup(2);
    pay(&mut env, 0).unwrap();
    let ix = close_ix(&env);
    let org = env.org.insecure_clone();
    expect_err(send(&mut env.svm, &[ix], &org, &[]), "SharesOutstanding");
}

// ---------------------------------------------------------------- T13

/// Random sequence of actions; the vault invariant must hold after every step.
#[test]
fn t13_invariant_fuzz() {
    let (mut total_picked, mut total_refunded) = (0u32, 0u32);
    for seed in 1..=5u64 {
        let n = 6;
        let mut env = setup(n);
        let mut x = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let mut next = |m: u64| {
            x = x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (x >> 33) % m
        };
        let mut t = T0;
        for _step in 0..60 {
            let who = next(n as u64) as usize;
            match next(7) {
                0 | 1 => { let _ = pay(&mut env, who); }
                2 => {
                    let ix = cancel_share_ix(&env, who);
                    let b = env.buyers[who].insecure_clone();
                    let _ = send(&mut env.svm, &[ix], &b, &[]);
                }
                3 => { let _ = lock_by_org(&mut env); }
                4 => { let _ = pickup(&mut env, who); }
                5 => { let _ = refund_by_outsider(&mut env, who); }
                _ => {
                    t += next(400) as i64;
                    set_time(&mut env.svm, t);
                }
            }
            check_vault_invariant(&env);
            // Money is conserved across everyone involved.
            let total: u64 = env.buyer_atas.iter().map(|a| bal(&env.svm, a)).sum::<u64>()
                + bal(&env.svm, &env.vault)
                + bal(&env.svm, &env.vendor_ata)
                + bal(&env.svm, &env.org_ata);
            assert_eq!(total, n as u64 * START_BALANCE);
            // The organiser never earns more than fee × pickups.
            let c = read_collection(&env);
            assert_eq!(bal(&env.svm, &env.org_ata), c.picked_count as u64 * FEE);
            assert_eq!(bal(&env.svm, &env.vendor_ata), c.picked_count as u64 * PRICE);
        }
        // After the deadline everything left must be refundable.
        set_time(&mut env.svm, PICKUP_BY + 10_000);
        for i in 0..n {
            let _ = refund_by_outsider(&mut env, i);
        }
        assert_eq!(bal(&env.svm, &env.vault), 0, "seed {seed}: money stuck in vault");
        check_vault_invariant(&env);
        let c = read_collection(&env);
        total_picked += c.picked_count;
        total_refunded += c.refunded_count;
    }
    eprintln!("fuzz: {total_picked} pickups, {total_refunded} refunds across 5 seeds");
    // The fuzz must actually reach both exits, or it proves nothing.
    assert!(total_picked > 0 && total_refunded > 0);
}
