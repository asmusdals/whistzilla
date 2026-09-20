# Bot evaluation — updated 2026-09-20

## Method

`packages/strategy/src/evaluation.test.ts` plays 32 seeded deals in CI and 128 when the report flag is set, rotating the challenger through all four seats for 128 or 512 games per comparison. `packages/strategy/src/bidding-evaluation.test.ts` separately measures 256 complete auctions per profile and 256 after a human 7 ordinary opening. Both use only generated deals and projected `PlayerView` decisions. No human replay or test-game history is read. The fixed-contract comparison forces 7 almindelige and makes every other player pass to isolate card play and contract setup.

Run the reproducible report with:

```sh
WHISTZILLA_EVAL_REPORT=1 npx vitest run packages/strategy/src/evaluation.test.ts --reporter=verbose --silent=false
WHISTZILLA_EVAL_REPORT=1 npx vitest run packages/strategy/src/bidding-evaluation.test.ts --reporter=verbose --silent=false
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

## Current 128-seed results

| Challenger against three opponents            | Mean points per game | Positive rounds | Numerical contracts | Mean numerical bid |
| --------------------------------------------- | -------------------: | --------------: | ------------------: | -----------------: |
| Intermediate vs Beginner                      |                +6.80 |           55.1% |           496 / 512 |               8.90 |
| Advanced vs Intermediate                      |                +9.57 |           56.8% |           499 / 512 |               9.17 |
| Advanced vs Intermediate, fixed 7 almindelige |                +0.74 |           60.9% |           512 / 512 |               7.00 |

The separate 256-deal auction fixture ended at levels 9–10 in 155 Beginner,
201 Intermediate, and 219 Advanced deals. Sol won 7, 6, and 8 auctions,
respectively; no Super bordlægger won in this sample. With a human opening
7 ordinary, Intermediate opponents ended at 9–10 in 194 of 256 deals.

These counts measure bidding style, not contract quality. In the 128-seed
full-game comparison, declarers succeeded in only 201 of 496 numerical
Intermediate-versus-Beginner games and 161 of 499 Advanced-versus-Intermediate
games. Advanced's higher mean points came largely from defending against
opponents' failed contracts; its declarer points were negative. The bidder's
team-trick estimate is therefore still optimistic at high levels, and the
playing strategy may also leave tricks on the table. The fixed-contract result
is a modest positive play-strength signal. Further work should calibrate
success rates by bid level and hand strength with expert examples before
claiming that these bids maximize expected points. No human replays are used.
