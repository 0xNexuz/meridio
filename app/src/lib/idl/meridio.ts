/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/meridio.json`.
 */
export type Meridio = {
  "address": "2CY5o9hxJLfmSj8cZfxRKsa8GXJxTFxry5bWfqTfNziv",
  "metadata": {
    "name": "meridio",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelCollection",
      "discriminator": [
        231,
        218,
        112,
        240,
        226,
        247,
        237,
        195
      ],
      "accounts": [
        {
          "name": "organizer",
          "signer": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "collection",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelShare",
      "discriminator": [
        182,
        159,
        51,
        236,
        71,
        57,
        198,
        55
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true,
          "relations": [
            "share"
          ]
        },
        {
          "name": "collection",
          "writable": true,
          "relations": [
            "share"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "collection"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "share",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "collection"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "closeCollection",
      "discriminator": [
        18,
        123,
        173,
        247,
        218,
        117,
        230,
        105
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "confirmPickup",
      "discriminator": [
        37,
        5,
        149,
        215,
        41,
        79,
        248,
        82
      ],
      "accounts": [
        {
          "name": "buyer",
          "signer": true,
          "relations": [
            "share"
          ]
        },
        {
          "name": "station",
          "signer": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "collection",
          "writable": true,
          "relations": [
            "share"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "collection"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "share",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "collection"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "vendorToken",
          "writable": true
        },
        {
          "name": "organizerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createCollection",
      "discriminator": [
        156,
        251,
        92,
        54,
        233,
        2,
        16,
        82
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "collection",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "organizer"
              },
              {
                "kind": "arg",
                "path": "args.collectionId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "collection"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createCollectionArgs"
            }
          }
        }
      ]
    },
    {
      "name": "lock",
      "discriminator": [
        21,
        19,
        208,
        43,
        237,
        62,
        255,
        87
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "collection",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "payShare",
      "discriminator": [
        95,
        14,
        255,
        254,
        57,
        192,
        231,
        238
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "mint",
          "relations": [
            "collection"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "share",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "collection"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "refundShare",
      "discriminator": [
        72,
        101,
        247,
        55,
        25,
        255,
        189,
        171
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "collection",
          "writable": true,
          "relations": [
            "share"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "collection"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "share",
          "writable": true
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "collection",
      "discriminator": [
        48,
        160,
        232,
        205,
        191,
        207,
        26,
        141
      ]
    },
    {
      "name": "share",
      "discriminator": [
        5,
        232,
        225,
        10,
        36,
        176,
        248,
        217
      ]
    }
  ],
  "events": [
    {
      "name": "collectionCancelled",
      "discriminator": [
        243,
        248,
        183,
        156,
        246,
        122,
        243,
        246
      ]
    },
    {
      "name": "collectionCreated",
      "discriminator": [
        69,
        167,
        76,
        142,
        182,
        183,
        233,
        139
      ]
    },
    {
      "name": "collectionLocked",
      "discriminator": [
        50,
        169,
        149,
        223,
        133,
        233,
        39,
        153
      ]
    },
    {
      "name": "shareCancelled",
      "discriminator": [
        107,
        166,
        158,
        13,
        231,
        91,
        125,
        156
      ]
    },
    {
      "name": "sharePaid",
      "discriminator": [
        36,
        246,
        242,
        254,
        175,
        66,
        177,
        78
      ]
    },
    {
      "name": "sharePickedUp",
      "discriminator": [
        115,
        10,
        83,
        173,
        248,
        170,
        71,
        184
      ]
    },
    {
      "name": "shareRefunded",
      "discriminator": [
        188,
        87,
        122,
        85,
        160,
        164,
        213,
        108
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroPrice",
      "msg": "Unit price must be greater than zero"
    },
    {
      "code": 6001,
      "name": "feeTooHigh",
      "msg": "Fee is above the 10% cap"
    },
    {
      "code": 6002,
      "name": "badBuyerLimits",
      "msg": "Minimum buyers must be at least 1 and no more than the number of units"
    },
    {
      "code": 6003,
      "name": "badDeadlines",
      "msg": "Deadlines must satisfy now < pay-by < pickup-by"
    },
    {
      "code": 6004,
      "name": "titleTooLong",
      "msg": "Title is too long"
    },
    {
      "code": 6005,
      "name": "notOpen",
      "msg": "This collection is not open"
    },
    {
      "code": 6006,
      "name": "notLocked",
      "msg": "This collection is not locked"
    },
    {
      "code": 6007,
      "name": "payByPassed",
      "msg": "The pay-by time has passed"
    },
    {
      "code": 6008,
      "name": "payByNotPassed",
      "msg": "The pay-by time has not passed yet"
    },
    {
      "code": 6009,
      "name": "pickupByPassed",
      "msg": "The pickup-by time has passed"
    },
    {
      "code": 6010,
      "name": "soldOut",
      "msg": "All units are taken"
    },
    {
      "code": 6011,
      "name": "notEnoughBuyers",
      "msg": "Not enough buyers have paid"
    },
    {
      "code": 6012,
      "name": "organizerOnly",
      "msg": "Only the organiser can do this now"
    },
    {
      "code": 6013,
      "name": "shareNotPaid",
      "msg": "This share is not in the Paid state"
    },
    {
      "code": 6014,
      "name": "refundNotAllowed",
      "msg": "This share cannot be refunded yet"
    },
    {
      "code": 6015,
      "name": "sharesOutstanding",
      "msg": "Some shares are still unsettled"
    },
    {
      "code": 6016,
      "name": "vaultNotEmpty",
      "msg": "The vault still holds tokens"
    },
    {
      "code": 6017,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "collection",
      "docs": [
        "One class purchase: e.g. \"BIO 201 textbook, 40 copies\"."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "vendor",
            "type": "pubkey"
          },
          {
            "name": "station",
            "docs": [
              "Key held at the vendor's pickup stand. It must co-sign every pickup."
            ],
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "collectionId",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "unitPrice",
            "docs": [
              "Paid to the vendor per pickup (token base units)."
            ],
            "type": "u64"
          },
          {
            "name": "feePerUnit",
            "docs": [
              "Paid to the organiser per pickup (token base units). At most unit_price / 10."
            ],
            "type": "u64"
          },
          {
            "name": "minBuyers",
            "type": "u32"
          },
          {
            "name": "maxUnits",
            "type": "u32"
          },
          {
            "name": "payBy",
            "type": "i64"
          },
          {
            "name": "pickupBy",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "collectionStatus"
              }
            }
          },
          {
            "name": "paidCount",
            "docs": [
              "Shares currently in the Paid state (money still in the vault)."
            ],
            "type": "u32"
          },
          {
            "name": "pickedCount",
            "type": "u32"
          },
          {
            "name": "refundedCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "collectionCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "collectionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "vendor",
            "type": "pubkey"
          },
          {
            "name": "unitPrice",
            "type": "u64"
          },
          {
            "name": "feePerUnit",
            "type": "u64"
          },
          {
            "name": "maxUnits",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "collectionLocked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "paidCount",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "collectionStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "locked"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "createCollectionArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collectionId",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "vendor",
            "type": "pubkey"
          },
          {
            "name": "station",
            "type": "pubkey"
          },
          {
            "name": "unitPrice",
            "type": "u64"
          },
          {
            "name": "feePerUnit",
            "type": "u64"
          },
          {
            "name": "minBuyers",
            "type": "u32"
          },
          {
            "name": "maxUnits",
            "type": "u32"
          },
          {
            "name": "payBy",
            "type": "i64"
          },
          {
            "name": "pickupBy",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "share",
      "docs": [
        "One student's share of one collection."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "unit_price + fee_per_unit, locked in at payment time."
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "shareStatus"
              }
            }
          },
          {
            "name": "paidAt",
            "type": "i64"
          },
          {
            "name": "settledAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "shareCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sharePaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sharePickedUp",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "toVendor",
            "type": "u64"
          },
          {
            "name": "toOrganizer",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "shareRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "shareStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "paid"
          },
          {
            "name": "pickedUp"
          },
          {
            "name": "refunded"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "collectionSeed",
      "type": "bytes",
      "value": "[99, 111, 108, 108, 101, 99, 116, 105, 111, 110]"
    },
    {
      "name": "maxFeeDivisor",
      "docs": [
        "The organiser's fee can be at most 1/10 of the unit price (10%)."
      ],
      "type": "u64",
      "value": "10"
    },
    {
      "name": "maxTitleLen",
      "type": "u32",
      "value": "64"
    },
    {
      "name": "shareSeed",
      "type": "bytes",
      "value": "[115, 104, 97, 114, 101]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
