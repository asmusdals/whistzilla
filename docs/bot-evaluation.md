# Bot evaluation — updated 2026-09-20

## Method

`packages/strategy/src/evaluation.test.ts` plays 32 seeded deals in CI and 128 when the report flag is set, rotating the challenger through all four seats for 128 or 512 games per comparison. `packages/strategy/src/bidding-evaluation.test.ts` separately measures 256 complete auctions per profile and 256 after a human 7 ordinary opening. Both use only generated deals and projected `PlayerView` decisions. No human replay or test-game history is read. The fixed-contract comparison forces 7 almindelige and makes every other player pass to isolate card play and contract setup.

Run the reproducible report with:

```sh
WHISTZILLA_EVAL_REPORT=1 npx vitest run packages/strategy/src/evaluation.test.ts --reporter=verbose --silent=false
WHISTZILLA_EVAL_REPORT=1 npx vitest run packages/strategy/src/bidding-evaluation.test.ts --reporter=verbose --silent=false
# Use different generated deals to check the calibration outside its tuning set:
WHISTZILLA_EVAL_REPORT=1 WHISTZILLA_EVAL_SEED_START=128 npx vitest run packages/strategy/src/evaluation.test.ts --reporter=verbose --silent=false
```

## Findings and changes

The first measurement showed special contracts in 511 of 512 Advanced-versus-Intermediate games. The special bid heuristic compared a hand-safety number with numerical expected points on incompatible scales. Numerical auctions also averaged about 10.2 tricks while declarer teams took about 7.4, largely because passing was penalized as if the rival's bid were likely to succeed.

Special bids now estimate a chance of success and compare the actual success/failure stakes from the game core. Numerical bids use a lower partnership baseline, a wider uncertainty distribution, and contract adjustments for the loss of trump or partner control. Passing is neutral, so a higher bid must have positive estimated return. These are provisional estimates; they are not learned from replay data.

The 2026-09-19 product-owner note reported that auctions escalated too often.
The first continuation policy then overcorrected: on 256 fixed deals,
Intermediate ended 192 at level 7 and 59 at level 8; only five were special.
The 2026-09-20 feedback instead asks for most auctions to end around the
strength of 9–10 ordinary, with lower bids and special contracts still possible.

The current provisional estimate starts at 7.0 team tricks for an average
hand, then responds more strongly to the bidder's own honors and suit length.
The continuation draw uses only the acting player's hand, public bids, seat,
and revision. Its base probabilities are 0.70, 0.82, and 0.90 for Beginner,
Intermediate, and Advanced. It starts reducing marginal overcalls after three
bids and above level 9; compelling hands bypass the draw. Sol's hand-safety
threshold was lowered so it remains uncommon but attainable. The
choices replay deterministically and cannot use another player's hidden hand.

## Contract-quality calibration

Breaking complete games down by numerical contract exposed the main weak
spot: only 32 of 130 Advanced Halve contracts succeeded in the first 128
seeds. In Halve the partner selects trump, so the bidder's own honors and
preferred suit predict the result less reliably than in Almindelige. Vip's
trump is also revealed from unknown kitty cards. The provisional estimate
therefore discounts Halve by 0.8 team tricks instead of 0.5 and Vip by 1.1
instead of 0.9. The Advanced bidding offset was reduced from +0.1 to 0;
its extra play analysis remains unchanged. These are strategy estimates,
not changes to game rules or card information.

The adjustment is intentionally specific to contract control. Lowering the
global partnership estimate moved too many auctions back to levels 7–8 and
failed the auction-mix check. The updated seed report also records success
and actual team tricks by level and bid type; a second 128-seed range starts
at seed 128. No human game or replay data is used.

## Current 128-seed results (seeds 0–127)

| Challenger against three opponents            | Mean points per game | Positive rounds | Numerical contracts | Mean numerical bid |
| --------------------------------------------- | -------------------: | --------------: | ------------------: | -----------------: |
| Intermediate vs Beginner                      |                +7.06 |           58.8% |           494 / 512 |               9.11 |
| Advanced vs Intermediate                      |                +9.13 |           61.3% |           500 / 512 |               9.30 |
| Advanced vs Intermediate, fixed 7 almindelige |                +0.74 |           60.9% |           512 / 512 |               7.00 |

The separate 256-deal auction fixture ended at levels 9–10 in 186 Beginner,
221 Intermediate, and 226 Advanced deals. Sol won 8, 6, and 6 auctions,
respectively; no Super bordlægger won in this sample. With a human opening
7 ordinary, Intermediate opponents ended at 9–10 in 216 of 256 deals.

On seeds 0–127, numerical contracts succeeded in 238 of 494 Intermediate
games (48.2%) and 191 of 500 Advanced games (38.2%), compared with 201 of
496 (40.5%) and 161 of 499 (32.3%) before this calibration. Advanced's
declarer points changed from -1178 to +342 in this range. On unseen seeds
128–255, numerical success was 216 of 498 (43.4%) and 177 of 500 (35.4%).
The mean numerical bids there were 9.02 and 9.25, respectively.

These results show a better bid mix and fewer unsuccessful contracts in the
measured ranges, but still leave many high contracts lost. They do not prove
optimal bidding or play. The partner's unseen cards, kitty, and longer-term
card play remain substantial sources of uncertainty. The fixed 7 ordinary
result is a modest positive play-strength signal. Expert-approved hand
examples would be needed for further calibration; human test replays remain
excluded from strategy training by product-owner request.
