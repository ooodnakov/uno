 Design direction: “Pocket table, live orbit”

 Identity: not casino, not UNO clone, not generic SaaS. More like a glowing pocket card table you can open on a phone.

 Aesthetic risk: tilted, orbiting card geometry as primary UI language. Seats, cards, table state, lobby rooms all use slight rotation/fan/orbit instead of flat cards in grids. Risk: playful distortion can hurt clarity. Constraint: only decorative cards
 tilt; interactive controls stay readable and aligned.

 ────────────────────────────────────────────────────────────────────────────────

 Token system

 ### Palette

 No warm cream default. No black + acid accent default. Use deep felt + plastic card inks.

 ┌─────────────┬───────────┬───────────────────────────────────┐
 │ Token       │ Hex       │ Use                               │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Felt night  │ ■ #102A2B │ app background, game table depth  │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Table green │ ■ #1F6F5B │ table centers, active play zones  │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Chalk mint  │ ■ #D9FFF2 │ primary text on dark surfaces     │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Card paper  │ ■ #FFF8E8 │ cards, panels, auth forms         │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Signal red  │ ■ #F04438 │ red cards, danger, turn urgency   │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Cobalt flip │ ■ #2F6BFF │ blue cards, focus, links          │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Golden draw │ ■ #FFC53D │ yellow cards, timers, invite code │
 ├─────────────┼───────────┼───────────────────────────────────┤
 │ Wild ink    │ ■ #1A1625 │ wild cards, overlays              │
 └─────────────┴───────────┴───────────────────────────────────┘

 Secondary card green: ■ #21A67A.

 ### Type

 Use real personality; not Inter-only.

 - Display: Unbounded or Russo One
   - Used for ONE / Один, room names, card symbols.
   - Reason: bilingual Cyrillic/Latin geometry, arcade-table feel.
 - Body: Manrope
   - Clear Cyrillic support, friendly UI rhythm.
 - Utility/data: JetBrains Mono
   - Invite codes, timers, seat numbers, event log timestamps.
   - Reason: server-authoritative “table console” feeling.

 If self-hosting fonts undesirable: use CSS font stacks now, add next/font/google later.

 ────────────────────────────────────────────────────────────────────────────────

 Layout concept

 ### Global shell

 Top nav becomes compact “table rail,” sticky but translucent.

 ```txt
   ┌────────────────────────────────────────────────────┐
   │ ONE / Один        Lobby     Rules      Login/Host  │
   └────────────────────────────────────────────────────┘
 ```

 Mobile:

 ```txt
   ┌────────────────────────┐
   │ ONE / Один       Menu  │
   └────────────────────────┘
 ```

 No hamburger unless nav grows. Current 3 links fit.

 ────────────────────────────────────────────────────────────────────────────────

 Home page redesign

 Hero thesis: you are already looking at a live table.

 ```txt
   Desktop
   ┌────────────────────────────────────────────────────────────┐
   │                                                            │
   │  Deal a fast table.                                       │
   │  Match color, call ONE,                                   │
   │  beat the timer.                                          │
   │                                                            │
   │  [Open lobby] [Create account]                            │
   │                                                            │
   │  registered tables only · 2–6 players · 10s turns          │
   │                                                            │
   │                         ╭──────── tilted live table ─────╮ │
   │                         │  opponent seats orbit cards    │ │
   │                         │       discard + draw pile      │ │
   │                         │  tiny event pips animate in    │ │
   │                         ╰────────────────────────────────╯ │
   └────────────────────────────────────────────────────────────┘
 ```

 Mobile:

 ```txt
   ┌────────────────────────────┐
   │ Deal a fast table.         │
   │ Match color. Call ONE.     │
   │ Beat the timer.            │
   │                            │
   │ [Open lobby]               │
   │ [Create account]           │
   │                            │
   │  tilted mini table preview │
   └────────────────────────────┘
 ```

 Copy:
 - Eyebrow: LIVE CARD TABLE
 - H1: Deal a fast table.
 - Lede: Create a room, invite friends, and play a server‑checked round with 10‑second turns.
 - CTA:
   - Primary: Open lobby
   - Secondary: Create account

 ────────────────────────────────────────────────────────────────────────────────

 Auth pages

 Make them feel like “checking into a table,” not boring forms.

 ```txt
   ┌─────────────────────────────┐
   │ Seat check                  │
   │ Username                    │
   │ Password                    │
   │ [Enter lobby]               │
   │                             │
   │ local debug: host / guest   │
   └─────────────────────────────┘
 ```

 Register:
 - Title: Claim a seat
 - Button: Create account
 - Error voice: Username is taken. Try another handle.

 Login:
 - Title: Return to table
 - Button: Enter lobby

 Memory mode note only if ONE_LOCAL_MEMORY=1 can be exposed later via server env flag. If not, keep docs-only.

 ────────────────────────────────────────────────────────────────────────────────

 Lobby redesign

 Lobby should feel like scanning table cards pinned to a wall.

 ```txt
   Desktop
   ┌────────────────────────────────────────────────────────────┐
   │ Lobby                                      [Create table]  │
   │ Join private table [ CODE____ ] [Join]                    │
   │                                                            │
   │ ┌ tilted room card ┐ ┌ tilted room card ┐ ┌ tilted room ┐  │
   │ │ Classic table    │ │ Late night 2v2   │ │ Private...  │  │
   │ │ 2/6 seats        │ │ 4/6 seats        │ │ code        │  │
   │ │ C3HWVH           │ │ ...              │ │ ...         │  │
   │ └──────────────────┘ └──────────────────┘ └─────────────┘  │
   └────────────────────────────────────────────────────────────┘
 ```

 Room cards:
 - Use invite code as mono “stamp.”
 - Active seat count visualized as six tiny pips.
 - Public/private shown as table state, not metadata badge:
   - Open table
   - Invite table

 Create room form:
 - Horizontal on desktop.
 - Bottom-sheet style on mobile.
 - Button text: Deal room.

 Empty lobby:
 - Current: No public waiting rooms yet.
 - Better: No open tables yet. Deal one and invite a second player.

 ────────────────────────────────────────────────────────────────────────────────

 Game room redesign

 Most important screen. Mobile-first.

 ### Desktop

 ```txt
   ┌──────────────────────────────────────────────────────────────┐
   │ Classic table  C3HWVH      WAITING/IN GAME      2/6 seats    │
   ├──────────────────────────────────────────────────────────────┤
   │                                                              │
   │      [opponent]       [opponent]       [opponent]            │
   │                                                              │
   │                 ╭──────── table center ───────╮              │
   │                 │ Draw 93     Red 7           │              │
   │                 │ clockwise · Host turn · 08s │              │
   │                 ╰─────────────────────────────╯              │
   │                                                              │
   │  Event rail / Chat                                  Reactions │
   │                                                              │
   │  ┌──────────────── own hand, fanned horizontally ─────────┐  │
   │  │ [R7] [B2] [Wild] [Skip] ...                            │  │
   │  └────────────────────────────────────────────────────────┘  │
   │                                                              │
   │              [Draw] [Pass] [ONE!]                           │
   └──────────────────────────────────────────────────────────────┘
 ```

 ### Mobile

 Game over chrome. Table first.

 ```txt
   ┌──────────────────────────────┐
   │ Classic table      C3HWVH    │
   │ Host turn              08s   │
   ├──────────────────────────────┤
   │ opponents: Guest · Bot · ... │
   │                              │
   │        Draw 93   Red 7       │
   │        current: RED          │
   │                              │
   │ [Draw] [Pass] [ONE!]         │
   │                              │
   │ hand: horizontally scroll    │
   │ [R7][B2][+4][S][G9]          │
   │                              │
   │ tabs: Table | Chat | Log     │
   └──────────────────────────────┘
 ```

 Key decisions:
 - Current player/timer always visible.
 - Chat/log below or tabbed on mobile.
 - Hand stays bottom, scroll-snap cards.
 - Wild color picker becomes radial 4-color chooser on desktop, full-width color strip on mobile.

 ────────────────────────────────────────────────────────────────────────────────

 Signature element

 Turn orbit.

 A thin animated ring around table center shows:
 - current color by ring color,
 - turn time by ring depletion,
 - direction by subtle moving dash,
 - active player by orbit label.

 This is specific to real-time card rules. Not decoration.

 Reduced motion:
 - ring still updates by width/color,
 - no moving dash.

 ────────────────────────────────────────────────────────────────────────────────

 Motion system

 Use one orchestrated motion language: deal, snap, pulse.

 - Page load: cards deal into hero table once.
 - Card hover: playable cards lift + brighten, not spin.
 - Play card: selected card “snaps” toward discard pile.
 - Timer: ring drains; last 3 seconds pulse gold → red.
 - Room cards: tiny tilt on hover.
 - New chat/event: slide in like table note.
 - Respect prefers-reduced-motion.

 Avoid scattered bouncy effects. One motion grammar.

 ────────────────────────────────────────────────────────────────────────────────

 Component redesign map

 ### src/app/page.tsx

 - Replace current hero copy/preview with live-table hero.
 - Add compact “rule chips”: 2–6 players, 10s turns, server checked.

 ### src/app/lobby/page.tsx

 - Rework page heading + join panel.
 - Keep forms/server actions unchanged.
 - Room grid becomes responsive table-card wall.

 ### src/app/login/page.tsx

 - Return to table copy.
 - Stronger form card.

 ### src/app/register/page.tsx

 - Claim a seat copy.
 - Same auth shell.

 ### src/app/room/[roomId]/page.tsx

 - Better page header:
   - room name
   - invite code chip
   - status
 - Keep server-side data loading unchanged.

 ### src/components/game/RoomClient.tsx

 - Restructure markup lightly:
   - top status rail
   - opponent orbit/strip
   - table center with turn orbit
   - hand dock
   - side drawer/chat
 - Keep socket logic unchanged.

 ### src/components/lobby/RoomCard.tsx

 - Add seat pips.
 - Rename labels in UI:
   - PUBLIC → Open table
   - PRIVATE → Invite table

 ### src/components/lobby/CreateRoomDialog.tsx

 - Make form visually compact.
 - Button: Deal room.

 ### src/app/globals.css

 - Main work:
   - tokens
   - typography
   - layout
   - card styles
   - animation
   - mobile breakpoints
   - reduced motion
   - focus states

 ────────────────────────────────────────────────────────────────────────────────

 Mobile rules

 - Use 100dvh, not 100vh, for game screen.
 - Hand dock:
   - horizontal scroll
   - scroll-snap-type: x proximity
   - cards min 72px, touch target 44px+
 - Action row sticky above hand.
 - Chat/log behind tab switch, not side-by-side.
 - Topbar compresses to brand + active user/action.
 - No hover-only states; playable cards need visible outline/glow.

 ────────────────────────────────────────────────────────────────────────────────

 Accessibility floor

 - Strong focus ring: cobalt outer + paper inner.
 - Timer not color-only: numeric seconds always visible.
 - Card labels remain text (+4, S, R, number).
 - Buttons say actions: Draw, Pass, ONE!.
 - Reduced motion disables hero deal, card snap, orbit dash.
 - Contrast checked against dark felt/paper cards.

 ────────────────────────────────────────────────────────────────────────────────

 Self-critique against brief

 Potential generic risks:
 - “Dark game UI” can become default gaming template.
 - “Glass/acrylic” can become Fluent clone.
 - “Animated cards” can become obvious.

 Corrections:
 - Use felt + paper + mono invite stamps, not glassmorphism.
 - Keep one signature animation: turn orbit.
 - Use bilingual geometric typography because ONE / Один needs Latin+Cyrillic identity.
 - Cards tilt only in decorative/table zones; forms and controls stay precise.

 Final direction is specific to:
 - real-time card table,
 - hidden hands,
 - invite codes,
 - 10-second turns,
 - ONE callout,
 - mobile friend play.