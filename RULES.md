# RULES.md

## Purpose

This document defines the game rules for **ONE / Один**, a real-time multiplayer color/number card game inspired by classic shedding card games.

The MVP should implement a classic ruleset first, while keeping the game engine extensible for future rule variants.

## Core design principles

* The server is authoritative.
* All moves must be validated on the server.
* The client may suggest an action, but never directly mutates game state.
* Hidden information must remain hidden.
* Rule behavior must be deterministic and covered by tests.
* Optional house rules should be controlled through `RuleConfig`.
* The first implemented preset is `CLASSIC`.

## MVP game mode

MVP mode:

* 2–6 players.
* Registered users only.
* Real-time play only.
* Single round winner: first player with zero cards wins.
* Same lobby can start multiple rounds.
* No score-to-500 in MVP.
* No blank cards.
* No custom cards.
* No official branding or official card art.

## Terminology

Use project-safe terminology:

* Game name: `ONE / Один`
* Call button: `ONE!` / `ОДИН!`
* Avoid official card logos or branding.

## Card colors

The game uses these colors:

```ts
type CardColor = "RED" | "BLUE" | "GREEN" | "YELLOW" | "WILD";
```

Playable declared colors are:

```ts
type DeclaredColor = "RED" | "BLUE" | "GREEN" | "YELLOW";
```

`WILD` is a card color category, not a declared active color after the card is played.

## Card kinds

The MVP deck supports:

```ts
type CardKind =
  | "NUMBER"
  | "SKIP"
  | "REVERSE"
  | "DRAW_TWO"
  | "WILD"
  | "WILD_DRAW_FOUR";
```

## Recommended classic deck composition

Use an official-style deck composition.

For each normal color:

* one `0`
* two each of `1–9`
* two `SKIP`
* two `REVERSE`
* two `DRAW_TWO`

Across all colors:

* four `WILD`
* four `WILD_DRAW_FOUR`

Total:

* 108 cards

Do not include blank cards in MVP.

## Initial setup

When a game starts:

1. Validate player count.
2. Create deck.
3. Shuffle deck using a server-side seed.
4. Deal 7 cards to each player.
5. Put one card from draw pile onto discard pile.
6. If the first discard is not valid as a starting card, draw another until valid.
7. Set `currentColor` from the first discard card.
8. Select starting player.
9. Set direction to clockwise: `1`.
10. Start turn timer.

## Starting discard rules

For MVP, the first discard should be a simple normal colored card if possible.

Recommended behavior:

* If first drawn discard is `NUMBER`, use it.
* If it is an action/wild card, return it to deck or place it aside and continue drawing.
* After selecting first discard, reshuffle skipped cards back into draw pile.

This avoids confusing first-turn edge cases.

## Turn order

Game state tracks:

```ts
currentPlayerIndex: number;
direction: 1 | -1;
```

To advance turn:

```ts
nextIndex = (currentPlayerIndex + direction + players.length) % players.length;
```

Skip effects advance an additional step.

## Matching rules

A player may play a card if at least one condition is true:

* card color equals current color,
* card number equals top discard number,
* card action kind equals top discard action kind,
* card is `WILD`,
* card is `WILD_DRAW_FOUR`.

Examples:

* Red 5 can be played on Red 9.
* Blue 5 can be played on Red 5.
* Green Skip can be played on Yellow Skip.
* Wild can be played on anything.
* Wild Draw Four can be played on anything in MVP unless challenge rules are enabled.

## Number cards

When a number card is played:

1. Place card on discard pile.
2. Set current color to card color.
3. Clear the player's `hasDeclaredOne` flag unless relevant state says otherwise.
4. Check if player has zero cards.
5. If not, advance turn normally.

## Skip card

When `SKIP` is played:

1. Place card on discard pile.
2. Set current color to card color.
3. Skip the next player.
4. Advance turn to the player after the skipped player.

In a 2-player game, Skip gives the same player another turn.

## Reverse card

When `REVERSE` is played:

1. Place card on discard pile.
2. Set current color to card color.
3. Reverse direction.
4. Advance turn according to new direction.

In a 2-player game, Reverse should behave like Skip for MVP compatibility unless a rules setting says otherwise.

Recommended MVP behavior:

```ts
if players.length === 2:
  same player gets another turn
else:
  direction *= -1
  advance turn
```

## Draw Two card

When `DRAW_TWO` is played:

1. Place card on discard pile.
2. Set current color to card color.
3. Next player draws 2 cards.
4. Next player loses their turn.
5. Turn advances to the following player.

If `stackDrawCards` is enabled later:

* next player may respond with `DRAW_TWO` or compatible draw card,
* pending draw count accumulates,
* player who cannot stack must draw accumulated cards and lose turn.

For MVP classic mode, do not stack draw cards.

## Wild card

When `WILD` is played:

1. Player must provide `declaredColor`.
2. Validate declared color is one of:

   * `RED`
   * `BLUE`
   * `GREEN`
   * `YELLOW`
3. Place card on discard pile.
4. Set `currentColor` to declared color.
5. Advance turn normally.

The client should show quick color buttons.

## Wild Draw Four card

When `WILD_DRAW_FOUR` is played:

1. Player must provide `declaredColor`.
2. Validate declared color.
3. Place card on discard pile.
4. Set `currentColor` to declared color.
5. Next player draws 4 cards.
6. Next player loses their turn.
7. Advance to the following player.

## Optional Wild Draw Four challenge

Setting:

```ts
challengeWildDrawFour: boolean;
```

For MVP, this can be stored but not implemented unless time permits.

If implemented:

* A player may challenge the previous `WILD_DRAW_FOUR`.
* Server checks whether the player who played it had a card matching the previous color.
* If the challenge succeeds:

  * player who played `WILD_DRAW_FOUR` draws 4.
* If challenge fails:

  * challenger draws 6 instead of 4.

The server must use previous turn hidden state or event metadata to resolve challenge. Do not trust client claims.

## Drawing rules

MVP recommended classic behavior:

1. If player has no playable card, they may draw one card.
2. If drawn card is playable, player may optionally play it immediately.
3. If player does not play it, they pass.
4. If drawn card is not playable, player passes.
5. If player has playable cards, drawing depends on rule config.

Relevant settings:

```ts
drawUntilPlayable: boolean;
allowPassWhenPlayable: boolean;
forcePlay: boolean;
```

Recommended MVP defaults:

```ts
drawUntilPlayable: false;
allowPassWhenPlayable: true;
forcePlay: false;
```

## Passing rules

A player may pass if:

* they have drawn this turn and did not play,
* or `allowPassWhenPlayable` is true,
* or they have no legal move.

If `forcePlay` is enabled:

* player may not pass while holding a playable card.

## Turn timer

Default:

```ts
turnSeconds: 10;
```

The server owns the timer.

On timeout:

1. Apply auto-pass if legal.
2. If auto-pass is not legal, perform draw-then-pass.
3. Broadcast game event.
4. Advance turn.

Do not pause the game when browser tab is inactive.

## ONE / Один declaration

When a player is about to go from 2 cards to 1 card, they must declare `ONE`.

MVP behavior:

* Player presses `ONE!` / `ОДИН!` before playing their second-to-last card.
* Server records `hasDeclaredOne = true`.
* If player plays down to one card without declaration, they become vulnerable to callout.
* Callout window remains open until the next player successfully performs an action.

## Callout

A player may call out another player who has one card and failed to declare `ONE`.

Successful callout:

* target draws 4 cards,
* target is no longer vulnerable,
* event is logged.

Callout is invalid if:

* target has more than one card,
* target has zero cards,
* target properly declared ONE,
* the callout window expired,
* caller is trying to call out themselves.

## Winning a round

A player wins immediately when their hand reaches zero cards.

On round win:

1. Set game status to `ROUND_FINISHED`.
2. Set winner.
3. Stop turn timer.
4. Persist final state.
5. Broadcast round result.
6. Lobby may start another round.

No score-to-500 in MVP.

## Deck exhaustion

If draw pile runs out:

1. Keep top discard card in discard pile.
2. Take the rest of discard pile.
3. Shuffle it into a new draw pile.
4. Continue game.

If there are still no cards available to draw:

* player passes,
* turn advances.

## Bots

Bots are used for:

* solo play,
* filling seats later,
* replacing disconnected players immediately.

MVP bot strategy:

1. Get legal moves.
2. Prefer first legal non-wild card.
3. Else play first legal wild card.
4. If wild is played, choose the color most common in bot hand.
5. If no legal play, draw.
6. If drawn card can be played, play it.
7. Else pass.

Bots should act server-side only.

## Disconnect and reconnect

When a player disconnects:

1. Mark player as disconnected.
2. Keep their seat reserved.
3. Set `controlledByBot = true`.
4. Bot controls seat on that player's turns.

When the same user reconnects:

1. Authenticate user.
2. Find their active room/game seat.
3. Set `isConnected = true`.
4. Set `controlledByBot = false`.
5. Send private visible state including their hand.

A disconnected user may reconnect anytime.

## Optional house rules

The engine should support future toggles:

```ts
stackDrawCards: boolean;
stackSkips: boolean;
jumpIn: boolean;
sevenZero: boolean;
forcePlay: boolean;
drawUntilPlayable: boolean;
allowPassWhenPlayable: boolean;
challengeWildDrawFour: boolean;
officialDeckComposition: boolean;
```

Do not implement all optional rules before the classic MVP is stable.

## Rule preset defaults

### CLASSIC

```ts
{
  preset: "CLASSIC",
  maxPlayers: 6,
  turnSeconds: 10,
  challengeWildDrawFour: false,
  stackDrawCards: false,
  stackSkips: false,
  jumpIn: false,
  sevenZero: false,
  forcePlay: false,
  drawUntilPlayable: false,
  allowPassWhenPlayable: true,
  officialDeckComposition: true
}
```

### HOUSE_PARTY

Future preset:

```ts
{
  preset: "HOUSE_PARTY",
  maxPlayers: 6,
  turnSeconds: 10,
  challengeWildDrawFour: true,
  stackDrawCards: true,
  stackSkips: true,
  jumpIn: true,
  sevenZero: true,
  forcePlay: false,
  drawUntilPlayable: false,
  allowPassWhenPlayable: true,
  officialDeckComposition: true
}
```

## Required engine tests

Implement tests for:

* deck composition,
* initial deal,
* visible state hides opponent hands,
* number-on-number match,
* color match,
* action-on-action match,
* invalid move rejection,
* skip behavior,
* reverse behavior,
* reverse in 2-player game,
* draw two behavior,
* wild color selection,
* wild draw four behavior,
* drawing,
* passing,
* timeout auto-pass,
* ONE declaration,
* failed ONE callout,
* successful ONE callout,
* round winner detection,
* deck exhaustion reshuffle,
* bot move selection,
* disconnected player bot takeover,
* reconnect seat reclaim.
