# Bot evaluation — 2026-09-19

## Method

`packages/strategy/src/evaluation.test.ts` plays 128 seeded deals, rotating the challenger through all four seats for 512 games per comparison. It uses only generated deals and projected `PlayerView` decisions. No human replay or test-game history is read. One comparison lets bidding proceed normally; another forces 7 almindelige and makes every other player pass to isolate card play and contract setup.

Run the reproducible report with:

```sh
WHISTZILLA_EVAL_REPORT=1 npx vitest run packages/strategy/src/evaluation.test.ts --reporter=verbose --silent=false
```

## Findings and changes

The first measurement showed special contracts in 511 of 512 Advanced-versus-Intermediate games. The special bid heuristic compared a hand-safety number with numerical expected points on incompatible scales. Numerical auctions also averaged about 10.2 tricks while declarer teams took about 7.4, largely because passing was penalized as if the rival's bid were likely to succeed.

Special bids now estimate a chance of success and compare the actual success/failure stakes from the game core. Numerical bids use a lower partnership baseline, a wider uncertainty distribution, and contract adjustments for the loss of trump or partner control. Passing is neutral, so a higher bid must have positive estimated return. These are provisional estimates; they are not learned from replay data.

The 2026-09-19 product-owner note reported that auctions still escalated too often.
A second, view-derived continuation draw now gives Beginner, Intermediate, and
Advanced different willingness to overcall (base probabilities 0.55, 0.70,
0.80). Each prior raise multiplies the probability by 0.70 and each level
above seven by 0.78. Bids with a very strong estimated return bypass the draw.
The draw uses only the acting player's hand, public bids, seat, and revision,
so a replay remains deterministic and hidden hands cannot affect the choice.
Across 100 fixed seeds, three bots left a human's 7 ordinary opening intact
35 times under this policy; the earlier test expected no more than 15.

## Current 128-seed results

| Challenger against three opponents            | Mean points per game | Positive rounds | Numerical contracts | Mean numerical bid |
| --------------------------------------------- | -------------------: | --------------: | ------------------: | -----------------: |
| Intermediate vs Beginner                      |                +1.58 |           57.0% |           509 / 512 |               7.08 |
| Advanced vs Intermediate                      |                +1.72 |           60.2% |           499 / 512 |               7.33 |
| Advanced vs Intermediate, fixed 7 almindelige |                +0.74 |           60.9% |           512 / 512 |               7.00 |

The fixed-contract result is a modest positive play-strength signal. The normal-auction result reflects both bidding and play; it does not isolate either. These deterministic fixtures catch regressions but do not prove optimal play or statistical superiority across all deals. Further work should stratify results by contract, bidder, partner status, and hand strength, then calibrate probability estimates against a larger set of generated games.
