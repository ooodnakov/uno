Continue working in this repo.

First read:
- RULES.md
- DATA_MODEL.md
- current src/lib/game code

Goal: implement the pure server-authoritative game engine.

Important:
- Do not touch Socket.IO yet except types if needed.
- Do not depend on React.
- Do not depend on Prisma.
- Game engine must be deterministic and testable.
- Hidden game state must remain separate from visible game state.

Implement under src/lib/game:

Files may include:
- types.ts
- cards.ts
- deck.ts
- rules.ts
- state.ts
- engine.ts
- bots.ts
- validators.ts
- index.ts

Implement:
1. Card types.
2. RuleConfig type and CLASSIC defaults.
3. Official-style 108-card deck generation:
   - per color: one 0, two 1–9, two SKIP, two REVERSE, two DRAW_TWO
   - four WILD
   - four WILD_DRAW_FOUR
4. Deterministic shuffle with seed.
5. Initial game state:
   - 2–6 players
   - 7 cards each
   - number card as starting discard
   - current color set from starting discard
   - direction = 1
6. Personalized visible state:
   - self sees own hand
   - opponents only show card counts
7. Legal move detection:
   - color match
   - number match
   - action kind match
   - wild cards
8. Move application:
   - PLAY_CARD
   - DRAW_CARD
   - PASS
   - DECLARE_ONE
   - CALLOUT_ONE
   - TIMEOUT_AUTO_PASS
9. Action cards:
   - SKIP
   - REVERSE
   - DRAW_TWO
   - WILD
   - WILD_DRAW_FOUR
10. 2-player Reverse behaves like Skip.
11. ONE / Один rules:
   - player with 2 cards may declare ONE
   - if player reaches 1 card without declaring, they become vulnerable
   - successful callout makes target draw 4
   - callout expires after next successful player action
12. Deck exhaustion:
   - keep top discard
   - reshuffle rest of discard into draw pile
   - if no draw cards available, pass
13. Round winner detection.
14. Basic bot move selection:
   - prefer first legal non-wild
   - else first legal wild
   - wild chooses most common color in bot hand
   - else draw/pass.

Tests:
Use Vitest. Add tests for every item listed in RULES.md "Required engine tests".

Do not implement optional house rules fully unless they are trivial.
Keep optional config fields present but default disabled.

After finishing:
- run tests,
- run typecheck,
- fix failures,
- summarize implemented engine behavior and any deliberate omissions.