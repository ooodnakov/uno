Continue working in this repo.

First read:
- RULES.md
- REALTIME_PROTOCOL.md
- DATA_MODEL.md
- structure.md
- current source code

Goal: implement account auth and room/lobby persistence before gameplay.

Scope:
- registered users only,
- username/password auth,
- public/private rooms,
- room creation,
- room join before game starts,
- lobby list,
- private invite support,
- host flag,
- max players 2–6,
- classic default rule config.

Use the Prisma schema from DATA_MODEL.md. If prisma/schema.prisma already exists, reconcile it with DATA_MODEL.md instead of replacing blindly.

Auth requirements:
1. Implement register.
2. Implement login.
3. Implement logout.
4. Use password hashing with argon2 or bcrypt.
5. Use secure session cookie.
6. Store session server-side if Session model exists.
7. Add helper to get current user on server.
8. Prevent unauthenticated users from accessing lobby/rooms.

Room requirements:
1. Create room page/dialog/form.
2. Room fields:
   - name
   - visibility PUBLIC/PRIVATE
   - maxPlayers
   - ruleConfig
3. Host automatically joins as seat 0.
4. Public lobby lists only public waiting rooms.
5. Join by room id/code/link.
6. Reject joining if:
   - room full,
   - room already in game,
   - user already joined.
7. Only host can start later, but do not implement gameplay start yet unless necessary placeholder.
8. Show room players in room page.

Implementation constraints:
- Keep business logic in server/lib modules, not directly inside React components where possible.
- Validate inputs.
- Keep room rule config compatible with RULES.md.
- Do not implement gameplay yet.
- Do not implement ranked/friends/admin.

After finishing:
- run Prisma format/generate/migration if applicable,
- run typecheck,
- run tests,
- update README.md with auth/lobby commands or notes.