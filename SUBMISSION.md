# Builder → Intelligent Contracts

**Title**

GlyphDock — Consensus Unicode confusable namespace

**Notes / Description**

GlyphDock is a GenLayer handle registry that reserves names by Unicode confusable skeleton. Deployment fetches the full Unicode 17.0.0 confusables file and verifies its fixed SHA-256. Validators independently re-fetch the source and check every imported mapping, including identity cases. The agreed 117-character table controls collisions such as m/rn and Latin/Cyrillic scope lookalikes. Signing wallets claim, transfer and release reservations. Exact spelling, current ownership and persistent epochs protect mutations and later reclaims. StudioNet proofs contain 12 finalized MAJORITY_AGREE receipts covering collisions, transfer, unauthorized and stale calls, release/reclaim, and unsupported invisible characters. Every step checks the table and tracked names against an independent source parser. GenVM lint, 22 direct tests and 9 transport tests passed. The namespace uses a fixed alphabet and first-come allocation.

**Evidence links**

- [Repository](https://github.com/gabrieladash123-bit/glyph-dock)
- [GenLayer contract source](https://github.com/gabrieladash123-bit/glyph-dock/blob/54cd2888509ca0a9eff01ef7ef2886834291c2e0/contracts/glyph_dock.py)
- [Contract explorer](https://explorer-studio.genlayer.com/address/0xcE8E6D6Bc1dce469bcc611fF6204Ae46B62598A8)
- [Deployment transaction](https://explorer-studio.genlayer.com/tx/0x956cc1b6fdeeecea4e6655815e636fd6ab80867ca6b6a5c3f712a395887973c4)
- [Twelve scenario receipts and state proofs](https://github.com/gabrieladash123-bit/glyph-dock/blob/main/proofs/README.md)
- [Passing checks](https://github.com/gabrieladash123-bit/glyph-dock/actions/runs/44469843309)
