# Super Fin — v10.3.0

Twelve new levels, a fourth world after Mega Fin. Built in the root `index.html` only. Little Fin, Big Fin, Mega Fin, their rules, their art, and the save keys `v6prog0`–`v6prog2` / `v6stars0`–`v6stars2` are unchanged. `fish/` is untouched. Nothing here is merged, and GitHub Pages, the APK, and the repo visibility are left alone.

Build label on the title: **v10.3.0**.

## How a level plays

Benji still does not steer live. The player fills the tray with arrows (Left, Down, Up, Right), then presses Play. He swims the whole queue.

- Water, an urchin, or a closed gate or rock ends the run. The usual miss resets him to the start and empties the tray. Pressing Reset on purpose keeps the queue.
- The pearls are a win only when the arrow that lands on them is the last arrow. Extra arrows keep swimming, including straight off the far side.
- A pad, clam, octopus, or activation square stays on for the rest of that run and clears every blocker of its colour.
- A tube is one arrow: Benji enters either mouth and lands on the other. The pair is two-way if he can step off the exit and step back on.
- Sand (`#`) is the path. It is not a wall. Empty cells are water.

Colours already in the game: coral pads `1` and clams `4` open gates `X` and rocks `x`; gold `2` / `5` open `Y` / `y`; pink `3` / `6` open `Z` / `z`; the octopus `O` (one `=` beside him) opens the grey bridge; the activation square `K` clears either the urchin `V` or the bubble rock `Q`, and each Super Fin level uses only one of those. Tubes are icy `A/a`, green `B/b`, and violet `C/c`. Violet was already drawn; these levels are the first to use it.

## Saves and how a finisher gets here

Worlds were never locked behind each other. `v6progN` is the highest unlocked index in that world, and a missing key means level 1 is playable. Super Fin reads and writes `v6prog3` and `v6stars3` with the same pattern. Those keys are created only when someone actually earns progress there. There is no new wipe of `benji_*` keys (the v9.9 and v10.1 wipes are unchanged and do not run again).

The title row is four buttons, centered, same size as before. Super Fin is the orange one (`#ff8a2a`). A player who has already finished Mega Fin sees it immediately and can start level 1. Later levels in the world unlock one by one, the same way Little, Big, and Mega do. Stars are still 3 / 2 / 1 from how many tries the win took. Old star arrays are not reset.

Names show on the Super Fin level buttons only. Older worlds have no names, so their buttons stay number and stars.

Hints match Mega: off until the bulb is tapped, stored in the existing `megaHints` key. The select line says so.

## Why the early levels are shorter than Mega's finale

Mega's hardest boards are 10-move exact trays. This pack does not start there. Hulk's early worlds teach one idea on a small board (about 8–11 tiles) and let the solution grow. Super Fin does that, then keeps going until it is clearly past Mega.

Solutions, in order: **6, 7, 8, 9, 10, 11, 12, 13, 13, 13, 14, 15**. Nothing gets shorter. Gold Gate steps up from Octo Arm. Gold Gate, Star Sweep, and Bubble Pop are three different pictures at 13. The last level is 15 arrows, five past Mega's longest. Early boards are 8–11 walkable tiles. From Octo Arm on, the boards fill more of a 5×6, which is still Mega's tile size (about 185px on the 1280×800 canvas; the smaller early boards are larger, up to 227px). Every board is at most 6 columns and 5 rows.

Every level except Five Rights is exact: the tray is exactly the shortest solution, checked with the in-game solver. Five Rights has one spare slot, and the only programs that win inside that tray are 6 arrows long. One more Left, the same direction as the last step, falls into the water.

No level is a one-arrow win. The all-Rights snake is seven Rights, not one command.

## The twelve levels

Shortest lengths below are from `window.__benji.solve` and `runSim` in the running page, not from a side copy of the rules.

| # | Name | Shortest | Slots | What is new | Pieces |
| --- | --- | --- | --- | --- | --- |
| 1 | Five Rights | 6 `RRRRRL` | 7 | Two strips. Five Rights, then one Left: you swim right and finish on the left. The spare Left falls off the pearls. | Blue tube |
| 2 | One Arrow | 7 `RRRRRRR` | 7 | A winding snake. Every arrow is Right, because the whirls on the corners do the turning. | Blue tube, green tube |
| 3 | Step Aside | 8 `DDDRRUUU` | 8 | The pearls are two tiles to the right, and the tile between them is missing, so the first arrow is Down. | Sand |
| 4 | Ride Back | 9 `RRLRRRRRR` | 9 | Warp onto a dead-end clam, ride that same whirl back, then take a second whirl to the rocks and the pearls. | Coral clam, blue tube, violet tube, coral rocks |
| 5 | Coral Pad | 10 `DDDRRRRUUU` | 10 | The coral gate stands under the pearls. The pad is on the way around. | Coral pad, coral gate |
| 6 | Gold Clam | 11 `RRURLDDDRRR` | 11 | The clam is a one-tile pocket. Step on it, step back, and the rocks in front of the pearls fall. | Gold clam, gold rocks |
| 7 | Octo Arm | 12 `RRRRDRDDLDLL` | 12 | The octopus arm is the missing tile in front of the pearls. | Octopus, bridge |
| 8 | Gold Gate | 13 `RRRRDDRRDRRRR` | 13 | The top row ends in water, so you turn down into the whirl. One sand beside the exit is a dead end. The gate is on that side, and riding the whirl home does not reach the pearls. | Green tube, gold pad, gold gate |
| 9 | Star Sweep | 13 `DDDDRRRRRUUUU` | 13 | The sea-star clears the urchin standing under the pearls. | Activation square, urchin blocker |
| 10 | Bubble Pop | 13 `RRRDDDDLRUURR` | 13 | A spur, not the Star Sweep loop. Step left onto the sea-star and walk back out. The last sand on the top row is a decoy: one more Right falls in. Then the bubble rock beside the pearls is open. | Activation square, bubble rock |
| 11 | Pink Pad | 14 `RRRRRDDDLDLLUL` | 14 | The pink pad is at the start of a long wind and the pink gate is at the pearls. Urchins fill the courtyard. | Pink pad, pink gate, urchins |
| 12 | Clam Hop | 15 `RRRRRDDLLLLRRRR` | 15 | Chomp the pink clam, hop the violet whirl, and the rocks in front of the pearls fall. A sand tile beside the exit lets you whirl home if the rocks are still up. | Pink clam, violet tube, pink rocks |

Every `G` is still the friend rescue. Rewards still appear after levels 5, 10, and 12.

### Which levels borrow a Hulk Smash beat

- **Five Rights** is the straight line that punishes over-programming, and the two-strip trick: the answer is Right five times, then Left.
- **One Arrow** is the winding snake whose corners are teleporters, solved by repeating one arrow. The pearls at the end are the friend rescue.
- **Step Aside** is the goal sitting two tiles away with the middle tile gone, so the first move leaves it.
- **Ride Back** is the warp out to a dead-end switch, the same warp home, then a second warp pair to the goal.
- **Pink Pad** is the visible-spike beat: urchins sit where a shortcut would be, and the tubes on One Arrow, Ride Back, Gold Gate, and Clam Hop are the teleporters, with the mouths always on the board.

Pads, clams, gates, rocks, the octopus bridge, both activation targets, sand, urchins, and all three whirl colours are used. No new obstacle and no new art were added. Decorative swirl discs stay off; the whirlpools are the tube mouths.

Super Fin pipes stay in the water or along the left edge of the screen. On these small boards the glass is wider than the gap between two tiles, so a route whose body would paint over a tile loses to one that does not. Little Fin, Big Fin, and Mega Fin keep the previous routes. The levels whose pipes moved are One Arrow, Ride Back, Gold Gate, and Clam Hop. Gold Gate and Bubble Pop are the levels whose grids changed. Pink Pad (14) and Clam Hop (15) are still longer than Bubble Pop.

## Solver

`tools/play-all.mjs` loads the page and calls the in-game solver. For every old level it checks that a solution exists, fits the tray, and `runSim` reports a goal. Big Fin and Mega Fin still match their exact slot counts (Little Fin level 3 is still the old spare-slot lesson, length 3 in a tray of 4). For Super Fin it also checks the four trick shapes, that Five Rights' extra Left is water, and that every alive state reachable within the tray can still reach the pearls.

All of that passed. No Super Fin state was trapped. Each new level placed one treat on sand.

## Play-all

Headless Chromium and WebKit, no console errors and no page errors.

| Browser | Viewport | Result |
| --- | --- | --- |
| Chromium | 1280×800 | Solver passed. Clicked Five Rights (Right ×5, Left, Play) through to a win. |
| Chromium | 844×390 | Solver passed. Same click-to-win. |
| Chromium | 820×1180 | Portrait. The rotate overlay is up (center pixel rgb 7, 49, 89). Solver still ran. Clicks are blocked, which is the existing phone lock. |
| WebKit | 1280×800 | Solver passed. Click-to-win. |
| WebKit | 844×390 | Solver passed. Click-to-win. |
| WebKit | 820×1180 | Portrait overlay. Solver passed. |

Screenshots of the title, the Super Fin picker, all 12 levels, and the Five Rights win are in `docs/levels-v10.3/`. Logs are in `docs/levels-v10.3/logs/`.

WebKit's headless audio device rejects `AudioContext.resume()`. The promise was already in a try/catch that does not catch rejections, so the page reported an unhandled rejection before any level logic ran. `resume()` is now caught. Swimming, the tray, and the music toggle are unchanged.
