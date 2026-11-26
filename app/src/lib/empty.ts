// Stand-in for Node's `fs` in the browser bundle. Anchor's local-file wallet
// (Wallet.local) is the only code that asks for it, and Meridio never uses that.
const empty = {};
export default empty;
