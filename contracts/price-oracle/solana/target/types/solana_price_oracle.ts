/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_price_oracle.json`.
 */
export type SolanaPriceOracle = {
  "address": "CefQJaxQTV28gCf4MMd1PgDHgCcRmuEHZgXZwjJReUY3",
  "metadata": {
    "name": "solanaPriceOracle",
    "version": "0.2.0",
    "spec": "0.1.0",
    "description": "The program holding the prices for the EVM chains"
  },
  "instructions": [
    {
      "name": "addAdminRole",
      "docs": [
        "Adds a new admin account.",
        "",
        "# Authorized",
        "",
        "- Owner"
      ],
      "discriminator": [
        118,
        25,
        199,
        154,
        76,
        13,
        182,
        146
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The signer must be the owner."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "docs": [
            "Program Config account. This program requires that the [`owner`] specified",
            "in the context equals the owner role stored in the config."
          ]
        },
        {
          "name": "adminAuthBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "newAdmin"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "addAssistantRole",
      "docs": [
        "Adds a new assistant account.",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin"
      ],
      "discriminator": [
        44,
        71,
        225,
        102,
        38,
        156,
        234,
        142
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "The signer can be the owner or an admin."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "assistantAuthBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "newAssistant"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newAssistant",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "cancelOwnerRoleTransferRequest",
      "docs": [
        "The owner role transfer is cancelled by the current one.",
        "",
        "# Authorized",
        "",
        "- Owner"
      ],
      "discriminator": [
        179,
        49,
        36,
        133,
        72,
        160,
        63,
        66
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "docs": [
            "Program Config account. This program requires that the [`signer`] specified",
            "in the context equals a pubkey specified in this account. Mutable,",
            "because we will update roles depending on the operation."
          ],
          "writable": true
        },
        {
          "name": "ownerCtx",
          "accounts": [
            {
              "name": "upgradeLock",
              "pda": {
                "seeds": [
                  {
                    "kind": "const",
                    "value": [
                      117,
                      112,
                      103,
                      114,
                      97,
                      100,
                      101,
                      95,
                      108,
                      111,
                      99,
                      107
                    ]
                  }
                ]
              }
            },
            {
              "name": "programData",
              "writable": true,
              "pda": {
                "seeds": [
                  {
                    "kind": "const",
                    "value": [
                      173,
                      22,
                      119,
                      151,
                      135,
                      78,
                      88,
                      97,
                      33,
                      175,
                      80,
                      213,
                      112,
                      245,
                      3,
                      90,
                      85,
                      21,
                      240,
                      206,
                      64,
                      184,
                      253,
                      15,
                      77,
                      178,
                      83,
                      12,
                      186,
                      241,
                      32,
                      60
                    ]
                  }
                ],
                "program": {
                  "kind": "const",
                  "value": [
                    2,
                    168,
                    246,
                    145,
                    78,
                    136,
                    161,
                    176,
                    226,
                    16,
                    21,
                    62,
                    247,
                    99,
                    174,
                    43,
                    0,
                    194,
                    185,
                    61,
                    22,
                    193,
                    36,
                    210,
                    192,
                    83,
                    122,
                    16,
                    4,
                    128,
                    0,
                    0
                  ]
                }
              }
            },
            {
              "name": "bpfLoaderUpgradeable",
              "address": "BPFLoaderUpgradeab1e11111111111111111111111"
            }
          ]
        }
      ],
      "args": []
    },
    {
      "name": "confirmOwnerRoleTransferRequest",
      "docs": [
        "The new owner confirms to be so.",
        "",
        "# Authorized",
        "",
        "- New Owner"
      ],
      "discriminator": [
        88,
        44,
        134,
        115,
        217,
        247,
        174,
        78
      ],
      "accounts": [
        {
          "name": "newOwner",
          "writable": true,
          "signer": true
        },
        {
          "name": "authBadgeNewOwner",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "newOwner"
              }
            ]
          }
        },
        {
          "name": "authBadgePreviousOwner",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "config.owner",
                "account": "priceOracleConfigState"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Program Config account. This program requires that the [`signer`] specified",
            "in the context equals a pubkey specified in this account. Mutable,",
            "because we will update roles depending on the operation."
          ],
          "writable": true
        },
        {
          "name": "ownerCtx",
          "accounts": [
            {
              "name": "upgradeLock",
              "pda": {
                "seeds": [
                  {
                    "kind": "const",
                    "value": [
                      117,
                      112,
                      103,
                      114,
                      97,
                      100,
                      101,
                      95,
                      108,
                      111,
                      99,
                      107
                    ]
                  }
                ]
              }
            },
            {
              "name": "programData",
              "writable": true,
              "pda": {
                "seeds": [
                  {
                    "kind": "const",
                    "value": [
                      173,
                      22,
                      119,
                      151,
                      135,
                      78,
                      88,
                      97,
                      33,
                      175,
                      80,
                      213,
                      112,
                      245,
                      3,
                      90,
                      85,
                      21,
                      240,
                      206,
                      64,
                      184,
                      253,
                      15,
                      77,
                      178,
                      83,
                      12,
                      186,
                      241,
                      32,
                      60
                    ]
                  }
                ],
                "program": {
                  "kind": "const",
                  "value": [
                    2,
                    168,
                    246,
                    145,
                    78,
                    136,
                    161,
                    176,
                    226,
                    16,
                    21,
                    62,
                    247,
                    99,
                    174,
                    43,
                    0,
                    194,
                    185,
                    61,
                    22,
                    193,
                    36,
                    210,
                    192,
                    83,
                    122,
                    16,
                    4,
                    128,
                    0,
                    0
                  ]
                }
              }
            },
            {
              "name": "bpfLoaderUpgradeable",
              "address": "BPFLoaderUpgradeab1e11111111111111111111111"
            }
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "deployer",
          "docs": [
            "Since we are passing on the upgrade authority, the original deployer is the only one",
            "who can initialize the program."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "docs": [
            "Owner of the program as set in the [`OwnerConfig`] account."
          ]
        },
        {
          "name": "ownerBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Owner Config account. This program requires that the `owner` specified",
            "in the context equals the pubkey specified in this account. Mutable.",
            "By using a PDA we guarantee that initialization can only be done once."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "programData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  173,
                  22,
                  119,
                  151,
                  135,
                  78,
                  88,
                  97,
                  33,
                  175,
                  80,
                  213,
                  112,
                  245,
                  3,
                  90,
                  85,
                  21,
                  240,
                  206,
                  64,
                  184,
                  253,
                  15,
                  77,
                  178,
                  83,
                  12,
                  186,
                  241,
                  32,
                  60
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                2,
                168,
                246,
                145,
                78,
                136,
                161,
                176,
                226,
                16,
                21,
                62,
                247,
                99,
                174,
                43,
                0,
                194,
                185,
                61,
                22,
                193,
                36,
                210,
                192,
                83,
                122,
                16,
                4,
                128,
                0,
                0
              ]
            }
          }
        },
        {
          "name": "bpfLoaderUpgradeable",
          "address": "BPFLoaderUpgradeab1e11111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "admins",
          "type": {
            "vec": "pubkey"
          }
        },
        {
          "name": "assistants",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "registerEvmPrices",
      "docs": [
        "Register the prices for a new EVM chain, with the initial prices:",
        "",
        "- `gas_price`: Mwei/gas",
        "- `price_per_tx_byte`: Mwei/byte",
        "- `gas_token_price`: μusd/Mwei",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin",
        "- Assistant"
      ],
      "discriminator": [
        72,
        97,
        186,
        123,
        63,
        246,
        217,
        207
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "prices",
          "docs": [
            "The prices for the given chain ID."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "chainId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "chainId",
          "type": "u16"
        },
        {
          "name": "gasTokenPrice",
          "type": "u64"
        },
        {
          "name": "gasPrice",
          "type": "u32"
        },
        {
          "name": "pricePerTxByte",
          "type": "u32"
        }
      ]
    },
    {
      "name": "registerSuiPrices",
      "docs": [
        "Register the prices for the Sui chain, with the initial prices:",
        "",
        "- `gas_token_price`: μusd/SUI",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin",
        "- Assistant"
      ],
      "discriminator": [
        223,
        20,
        236,
        68,
        91,
        160,
        99,
        145
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "prices",
          "docs": [
            "The prices for the given chain ID."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "chainId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "chainId",
          "type": "u16"
        },
        {
          "name": "gasTokenPrice",
          "type": "u64"
        },
        {
          "name": "computationUnitPrice",
          "type": "u32"
        },
        {
          "name": "bytePrice",
          "type": "u32"
        },
        {
          "name": "rebateRatio",
          "type": "u8"
        }
      ]
    },
    {
      "name": "removeAdminRole",
      "docs": [
        "Removes an admin account.",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin"
      ],
      "discriminator": [
        67,
        136,
        127,
        124,
        241,
        146,
        61,
        251
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "The signer can be the owner or an admin."
          ],
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "config",
          "docs": [
            "Program Config account. This program requires that the [`owner`] specified",
            "in the context equals the owner role stored in the config."
          ]
        },
        {
          "name": "authBadgeToBeRemoved",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "removeAssistantRole",
      "docs": [
        "Removes an assistant account.",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin"
      ],
      "discriminator": [
        195,
        240,
        99,
        244,
        203,
        21,
        126,
        148
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "The signer can be the owner or an admin."
          ],
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "authBadgeToBeRemoved",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "submitOwnerRoleTransferRequest",
      "docs": [
        "Updates the owner account. This needs to be either cancelled or approved.",
        "",
        "# Authorized",
        "",
        "- Owner"
      ],
      "discriminator": [
        40,
        109,
        216,
        207,
        96,
        26,
        239,
        152
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "docs": [
            "Program Config account. This program requires that the [`signer`] specified",
            "in the context equals a pubkey specified in this account. Mutable,",
            "because we will update roles depending on the operation."
          ],
          "writable": true
        },
        {
          "name": "ownerCtx",
          "accounts": [
            {
              "name": "upgradeLock",
              "pda": {
                "seeds": [
                  {
                    "kind": "const",
                    "value": [
                      117,
                      112,
                      103,
                      114,
                      97,
                      100,
                      101,
                      95,
                      108,
                      111,
                      99,
                      107
                    ]
                  }
                ]
              }
            },
            {
              "name": "programData",
              "writable": true,
              "pda": {
                "seeds": [
                  {
                    "kind": "const",
                    "value": [
                      173,
                      22,
                      119,
                      151,
                      135,
                      78,
                      88,
                      97,
                      33,
                      175,
                      80,
                      213,
                      112,
                      245,
                      3,
                      90,
                      85,
                      21,
                      240,
                      206,
                      64,
                      184,
                      253,
                      15,
                      77,
                      178,
                      83,
                      12,
                      186,
                      241,
                      32,
                      60
                    ]
                  }
                ],
                "program": {
                  "kind": "const",
                  "value": [
                    2,
                    168,
                    246,
                    145,
                    78,
                    136,
                    161,
                    176,
                    226,
                    16,
                    21,
                    62,
                    247,
                    99,
                    174,
                    43,
                    0,
                    194,
                    185,
                    61,
                    22,
                    193,
                    36,
                    210,
                    192,
                    83,
                    122,
                    16,
                    4,
                    128,
                    0,
                    0
                  ]
                }
              }
            },
            {
              "name": "bpfLoaderUpgradeable",
              "address": "BPFLoaderUpgradeab1e11111111111111111111111"
            }
          ]
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateEvmPrices",
      "docs": [
        "Update prices for an already registered EVM chain.",
        "",
        "- `gas_price`: Mwei/gas",
        "- `price_per_tx_byte`: Mwei/byte",
        "- `gas_token_price`: μusd/Mwei",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin",
        "- Assistant"
      ],
      "discriminator": [
        227,
        112,
        155,
        139,
        36,
        38,
        10,
        47
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "prices",
          "docs": [
            "The prices for the given chain ID."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "gasTokenPrice",
          "type": "u64"
        },
        {
          "name": "gasPrice",
          "type": "u32"
        },
        {
          "name": "pricePerTxByte",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateSolPrice",
      "docs": [
        "Update the Solana price, in μusd/SOL.",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin",
        "- Assistant"
      ],
      "discriminator": [
        166,
        98,
        183,
        175,
        125,
        81,
        109,
        119
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Any authorized account: owner, admin or assistant."
          ],
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "config",
          "docs": [
            "This program Config account. This program requires that the [`signer`]",
            "specified in the context equals a pubkey specified in this account.",
            "Mutable, because we will update the `sol_price` field."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newSolPrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateSuiBytePrice",
      "discriminator": [
        51,
        12,
        156,
        156,
        159,
        237,
        21,
        102
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "prices",
          "docs": [
            "The prices for the given chain ID."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "bytePrice",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateSuiPrices",
      "docs": [
        "Update the prices for the Sui chain.",
        "",
        "- `gas_token_price`: μusd/SUI",
        "",
        "# Authorized",
        "",
        "- Owner",
        "- Admin",
        "- Assistant"
      ],
      "discriminator": [
        29,
        192,
        2,
        161,
        189,
        168,
        36,
        153
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "prices",
          "docs": [
            "The prices for the given chain ID."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "gasTokenPrice",
          "type": "u64"
        },
        {
          "name": "computationUnitPrice",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateSuiRebateRatio",
      "discriminator": [
        223,
        44,
        231,
        218,
        150,
        65,
        61,
        213
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "authBadge",
          "docs": [
            "Proof that the signer is authorized."
          ]
        },
        {
          "name": "prices",
          "docs": [
            "The prices for the given chain ID."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "rebateRatio",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "authBadgeState",
      "discriminator": [
        230,
        136,
        128,
        117,
        214,
        51,
        214,
        152
      ]
    },
    {
      "name": "priceOracleConfigState",
      "discriminator": [
        86,
        37,
        173,
        69,
        170,
        230,
        127,
        150
      ]
    },
    {
      "name": "pricesState",
      "discriminator": [
        55,
        137,
        49,
        187,
        15,
        99,
        1,
        30
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "adminsAndAssistantsCountMismatch",
      "msg": "adminsAndAssistantsCountMismatch"
    },
    {
      "code": 6001,
      "name": "ownerOnly",
      "msg": "ownerOnly"
    },
    {
      "code": 6002,
      "name": "ownerOrAdminOnly",
      "msg": "ownerOrAdminOnly"
    },
    {
      "code": 6003,
      "name": "authorizedOnly",
      "msg": "authorizedOnly"
    },
    {
      "code": 6004,
      "name": "pendingOwnerOnly",
      "msg": "pendingOwnerOnly"
    },
    {
      "code": 6005,
      "name": "alreadyTheOwner",
      "msg": "alreadyTheOwner"
    },
    {
      "code": 6006,
      "name": "ownerDeletionForbidden",
      "msg": "ownerDeletionForbidden"
    },
    {
      "code": 6007,
      "name": "assistantDeletionOnly",
      "msg": "assistantDeletionOnly"
    },
    {
      "code": 6008,
      "name": "invalidChainId",
      "msg": "invalidChainId"
    },
    {
      "code": 6009,
      "name": "overflow",
      "msg": "overflow"
    },
    {
      "code": 6010,
      "name": "divisionByZero",
      "msg": "divisionByZero"
    }
  ],
  "types": [
    {
      "name": "authBadgeState",
      "docs": [
        "A badge indicating that an admin account is authorized."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "isAdmin",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "priceOracleConfigState",
      "docs": [
        "The program's main account."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Program's owner."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingOwner",
            "docs": [
              "Intermediate storage for the pending owner. Is used to transfer ownership."
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "solPrice",
            "docs": [
              "The SOL price in μusd/SOL."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pricesState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chainId",
            "type": "u16"
          },
          {
            "name": "gasTokenPrice",
            "type": "u64"
          },
          {
            "name": "prices",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "seedPrefixUpgradeLock",
      "type": "bytes",
      "value": "[117, 112, 103, 114, 97, 100, 101, 95, 108, 111, 99, 107]"
    }
  ]
};
