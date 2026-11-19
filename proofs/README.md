# StudioNet scenario proofs

GlyphDock is deployed at [0xcE8E6D6Bc1dce469bcc611fF6204Ae46B62598A8](https://explorer-studio.genlayer.com/address/0xcE8E6D6Bc1dce469bcc611fF6204Ae46B62598A8) on gasless GenLayer StudioNet, chain 61999.

[Tested contract](https://github.com/gabrieladash123-bit/glyph-dock/blob/54cd2888509ca0a9eff01ef7ef2886834291c2e0/contracts/glyph_dock.py) · [Passing workflow](https://github.com/gabrieladash123-bit/glyph-dock/actions/runs/44469843309) · [Verification report](verified.json).

Contract source SHA-256 is bf4037f60c0b2f425d8fecf7b8a68a55f883678c70f658ed48277f57676246d6. The deployed payload and a fresh gen_getContractCode read matched those exact source bytes. The full Unicode source SHA-256 is 091c7f82fc39ef208faf8f94d29c244de99254675e09de163160c810d13ef22a.

| Scenario | Execution | Agree / disagree / idle | Explorer | Receipt |
| --- | --- | --- | --- | --- |
| Import Unicode mappings through consensus | SUCCESS | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0x956cc1b6fdeeecea4e6655815e636fd6ab80867ca6b6a5c3f712a395887973c4) | [deploy](deploy-receipt.json) |
| First wallet claims scope | SUCCESS | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0x8378049d48174b0116b624e1148992c75cf876aa0d65e35ce8a0ff1869d330cd) | [claim-scope](claim-scope-receipt.json) |
| Reject Cyrillic lookalike collision | ERROR | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0xb8dabdfcc1240bea881ca9773c3239e14092ca74b7a298736ef7c4eaab74a944) | [block-cyrillic-alias](block-cyrillic-alias-receipt.json) |
| Transfer scope to second wallet | SUCCESS | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0xc2776d000971600a5443b574d95f487672eb0caf31f91ed16e6842018d3dff36) | [transfer-scope](transfer-scope-receipt.json) |
| Reject former owner | ERROR | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0x121bff01923b08f2876ed7e980f6d6e636c2ac74feef946b1741f5ad02db08fb) | [block-former-owner](block-former-owner-receipt.json) |
| Reject stale owner command | ERROR | 4 / 0 / 1 | [Transaction](https://explorer-studio.genlayer.com/tx/0x0237f947d3a19c1a34cbba6a6b7e004083b0d6a975261bb13c472d372fea3cf9) | [block-stale-epoch](block-stale-epoch-receipt.json) |
| Current owner releases scope | SUCCESS | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0xd9f290ee1954bf2f1597a6ca86c261ab07b2482e0138da4ed9320eeb2a270f54) | [release-scope](release-scope-receipt.json) |
| Reclaim the free skeleton under its Cyrillic spelling | SUCCESS | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0xb50ff57020461e16b8d432b38a0d5ed10466fb72421727574fd8170a840ca180) | [reclaim-cyrillic](reclaim-cyrillic-receipt.json) |
| Claim m, reserving the rn skeleton | SUCCESS | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0xcfe2172323f9b6073e92e5543ba6bbd611199f24e34d28cdbaf7333e96dee066) | [claim-m](claim-m-receipt.json) |
| Reject rn collision | ERROR | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0x5ba39ef93e457bb8ac5cdfb7a7a974f336c610ddf4365a277385264f8bc25a3a) | [block-rn](block-rn-receipt.json) |
| Reject zero-width input | ERROR | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0xe1e904673e3d6bb15d41cf42a3bdc6a74daa3afc9155729e5cb301d038a21c3e) | [block-invisible](block-invisible-receipt.json) |
| Reject mutation using an alias spelling | ERROR | 3 / 0 / 2 | [Transaction](https://explorer-studio.genlayer.com/tx/0x40778b4a04ef2051487c5b3af06ca2c41d331cc1234b7acc41212f0ce6c58950) | [block-wrong-spelling](block-wrong-spelling-receipt.json) |

All 12 receipts finalized with MAJORITY_AGREE. Six successful calls include the deployment. Six expected failures returned the exact specified error and preserved the previous observed namespace state. Each receipt was checked for signer, recipient and decoded calldata.

The proof independently parsed the complete Unicode file and verified every one of the 117 imported mappings. After every call it read the policy, active count, and scope/ѕсоре/m/rn/free records. Aliases shared one record. The final active count is two. The scope skeleton has epoch 4 and is registered as ѕсоре to the second wallet. The rn skeleton has epoch 1 and is registered as m to the first wallet.

A separate offline verifier replays the ownership model against every saved receipt and state snapshot. It checks stale calls, state preservation, source hashes, the upstream table, consensus votes and actual signed arguments.

~~~sh
npm ci
node scripts/verify-proofs.cjs
~~~

The direct GenVM suite passed 22 tests. The transport suite passed 9 tests. The live caller wallets are encrypted disposable CI accounts. The public receipts contain their addresses and signed operations.

The namespace supports 1–32 characters from its fixed alphabet. Case is significant. The profile only covers the published subset of Unicode and confusable mappings. Names are allocated on a first-come basis.

[Transaction journal](transactions.json) · [Submission text](../SUBMISSION.md).

The [initial run](https://github.com/gabrieladash123-bit/glyph-dock/actions/runs/44469025050) exposed a native Address conversion error during transfer. The corrected contract adds a native-calldata regression test. All receipts above belong to the corrected deployment and source digest.
