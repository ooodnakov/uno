# DESIGN.md

## Product vision

**ONE / Один** is a polished public web game platform for playing real-time multiplayer color/number card games with friends and strangers.

The app should feel:

* clean,
* fast,
* mobile-friendly,
* playful but minimal,
* stable enough for real games,
* extensible for future variants.

The first version focuses on a classic ruleset. Later versions add house rules, ranked matchmaking, friends, profiles, achievements, themes, and Telegram quick play.

## Target users

Primary:

* friends who want a quick online card game,
* small groups of 2–6 players,
* users joining via invite links.

Secondary:

* public players browsing open lobbies,
* Telegram users launching a quick game,
* solo users playing against bots.

## Platforms

MVP:

* desktop browser,
* mobile browser.

Later:

* Telegram Mini App.

## Core user flows

### Register

1. User opens app.
2. User chooses register.
3. User enters username, password, display name.
4. Account is created.
5. User lands on lobby page.

### Login

1. User enters username/password.
2. Session is created.
3. User lands on lobby page.

### Create room

1. User clicks Create Room.
2. User selects:

   * public or private,
   * max players,
   * rules preset,
   * optional rule toggles.
3. Room is created.
4. User becomes host.
5. User waits for players.
6. Host starts game.

### Join public room

1. User opens lobby list.
2. User selects room.
3. If room is not started and not full, user joins.
4. User appears in seat list.

### Join private room

1. User opens invite link.
2. If logged in, user joins room.
3. If not logged in, user logs in/registers first.
4. User is redirected back to room.

### Play turn

1. Server emits current visible game state.
2. Current player sees highlighted playable cards.
3. Player clicks or drags a card.
4. Client sends move request.
5. Server validates move.
6. Server applies move.
7. Server broadcasts updated visible state.
8. Event log updates.

### Use wild card

1. Player plays wild card.
2. Player chooses new color via quick buttons.
3. Server validates and applies selected color.

### Say ONE / Один

1. Player has two cards.
2. Before playing down to one card, player must press ONE/ОДИН.
3. If they forget, other players may call them out.
4. Successful callout applies penalty.
5. If next player already acted, callout expires.

### Disconnect

1. Player disconnects.
2. Server marks player as disconnected.
3. Bot immediately controls that seat.
4. Original user may reconnect anytime.
5. On reconnect, user reclaims seat and receives private hand state.

## UI principles

* Minimal clean web UI.
* Player hand is at bottom.
* Opponents are shown around table or compact list depending on screen size.
* Playable cards are highlighted.
* Invalid moves are blocked silently.
* Current color is always prominent.
* Turn timer is always visible.
* Game log is visible but compact.
* Chat should not dominate the game board.
* Mobile must be first-class.

## Game table layout

Desktop:

* center: discard pile, draw pile, current color, direction indicator,
* bottom: current player hand,
* sides/top: opponent seats,
* right drawer: chat/event log,
* top bar: room name, settings, leave button.

Mobile:

* center: simplified table,
* bottom: scrollable hand,
* top: compact opponent row,
* collapsible chat/log,
* large action buttons.

## Visual style

* Do not use official UNO branding.
* Use original card design.
* Cards should have strong color and clear symbols.
* Use numbers and symbols, not long labels.
* Support themes later.

MVP card colors:

* red,
* blue,
* green,
* yellow,
* wild/dark.

## Room settings

MVP settings:

* visibility: public/private,
* max players: 2–6,
* preset: Classic,
* turn timer: 10 seconds,
* bots allowed: true/false,
* challenge Wild Draw Four: optional,
* draw stacking: optional,
* jump-in: optional,
* seven-zero: optional,
* force play: optional,
* draw until playable: optional,
* allow pass with playable card: optional.

For MVP, implement only settings that are easy to support safely. Other toggles can be visible as disabled “coming later” options if desired.

## Success criteria

Weekend MVP is successful when:

* two real users can register,
* one creates a room,
* another joins,
* host starts game,
* both can play a full round,
* bot can replace a disconnected player,
* reconnect works,
* mobile layout is usable,
* game can be deployed with Docker Compose.

## Future roadmap

### Phase 2

* Telegram Mini App launch flow.
* Friend list.
* Invite friends.
* User profiles.
* Persistent stats.
* Better bots.
* Full custom rule presets.
* Admin panel basics.

### Phase 3

* Ranked matchmaking.
* ELO/MMR.
* Seasons.
* Achievements.
* Themes and cosmetics.
* Replay viewer.
* Moderation/reporting.
* Tournament mode.

### Phase 4

* Additional ONE variants.
* Custom game modes.
* Event-based live game rooms.
* Spectator mode improvements.

