Continue working in this repo.

First read:
- RULES.md
- REALTIME_PROTOCOL.md
- DATA_MODEL.md
- structure.md
- current app/components code

Goal: build a usable responsive MVP UI for ONE / Один.

Pages:
- /
- /login
- /register
- /lobby
- /room/[roomId]

UI style:
- minimal clean web UI,
- original look,
- no official UNO branding,
- desktop and mobile responsive,
- player hand at bottom,
- opponents around table or compact list,
- current color prominent,
- current turn prominent,
- 10-second turn timer visible.

Lobby:
1. Show public waiting rooms.
2. Create public/private room.
3. Join room.
4. Show max players, current players, rule preset.
5. Private rooms accessible by link/code.

Room waiting state:
1. Show players/seats.
2. Show host.
3. Show room settings.
4. Host can start game.
5. Non-host waits.

Game UI:
1. Show self hand.
2. Highlight playable cards from game:state.availableActions.playableCardIds.
3. Allow click to play.
4. Support drag-to-play if easy, but click is required.
5. For wild cards, show quick color buttons:
   - RED
   - BLUE
   - GREEN
   - YELLOW
6. Draw button.
7. Pass button.
8. ONE / ОДИН button.
9. Callout button when available.
10. Show opponents with card counts.
11. Show disconnected/bot-controlled badges.
12. Show discard pile top card.
13. Show draw pile count.
14. Show direction.
15. Show event log.
16. Show text chat.
17. Show reactions.

Behavior:
- Invalid moves should be blocked silently client-side when possible.
- Server errors can be shown as small toast/message.
- Client timer is display-only.
- Reconnect should restore current room/game view.

Do not implement:
- ranked,
- achievements,
- themes store,
- friends,
- public profiles,
- admin panel,
- Telegram Mini App.

After finishing:
- run typecheck,
- run tests,
- make sure mobile layout is usable,
- update README.md with playtest instructions