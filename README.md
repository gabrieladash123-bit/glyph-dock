# GlyphDock

GlyphDock reserves application handles by their Unicode confusable skeleton. Reserving `m` also blocks `rn`. Reserving `scope` blocks its supported Cyrillic lookalike `ѕсоре`. Each reservation has an owner who can transfer or release it.

Deployed on gasless GenLayer StudioNet at [0xcE8E6D6Bc1dce469bcc611fF6204Ae46B62598A8](https://explorer-studio.genlayer.com/address/0xcE8E6D6Bc1dce469bcc611fF6204Ae46B62598A8). [Deployment transaction](https://explorer-studio.genlayer.com/tx/0x956cc1b6fdeeecea4e6655815e636fd6ab80867ca6b6a5c3f712a395887973c4) · [Twelve finalized scenario receipts](proofs/README.md) · [Submission text](SUBMISSION.md).

## Consensus import

Deployment fetches the full [Unicode 17.0.0 confusables file](https://www.unicode.org/Public/17.0.0/security/confusables.txt). Its SHA-256 digest is fixed in the contract. The leader compiles mappings for the 117 characters in the instance's explicit alphabet. Validators independently fetch and hash the full file, index its records by code point, and verify every selected mapping. Identity mappings require that the source file contains no replacement for that character. A missing source or digest mismatch prevents deployment.

The contract stores only the agreed table. A caller supplies a handle rather than a skeleton or policy. The contract applies the imported mappings and NFD normalization to produce the reservation key. All supported input code points are NFD-stable. Mapping targets may contain several characters, which is why `m` and `rn` share a key.

## Ownership

- `claim(label)` reserves a free skeleton for the signing wallet.
- `resolve(label)` reports the skeleton, exact registered spelling, owner and epoch. All supported aliases resolve to the same record.
- `transfer(label, epoch, recipient)` changes ownership.
- `release(label, epoch)` frees a reservation.
- `policy()` exposes the source digest, alphabet, mappings, maximum length and active count.

Transfer and release require the exact registered spelling, current owner's signature and current epoch. Epochs persist after release and increment after every successful mutation, preventing stale commands from affecting a later registration. Zero recipients and self-transfers are rejected.

Labels contain 1–32 characters from the contract's explicit alphabet. Case is significant under the Unicode mapping. The profile supports a bounded selection of Latin, Greek and Cyrillic characters. Characters outside that alphabet, including combining input marks and zero-width characters, are rejected. Handles use first-come allocation, with collision protection determined by this fixed mapping profile.

## Verification

```sh
pip install -r requirements-dev.txt
genvm-lint download --version v0.2.16
genvm-lint check contracts/glyph_dock.py
python -m pytest tests/direct -q
npm ci
node --test tests/rpc-preflight.test.cjs
node scripts/verify-proofs.cjs
```

The direct tests exercise the real contract, replay validators against altered and missing mappings, test source tampering, compare every supported character against the upstream file, and check collision, ownership, release, reclaim and stale-epoch behavior. Transfer is tested with native SDK Address calldata as well as direct-test byte fixtures. The live CLI proof uses two encrypted disposable wallets and checks the imported table plus every tracked reservation after each successful and rejected call.

The Unicode fixture is redistributed with its [Unicode License v3](fixtures/UNICODE-LICENSE.txt). The contract and namespace mechanism are implemented here. Generic CLI transport is reused under MIT. [Unicode confusable detection](https://www.unicode.org/reports/tr39/#Confusable_Detection) describes the mapping approach.
