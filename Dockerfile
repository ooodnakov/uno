FROM node:22-alpine AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

WORKDIR /app
ENV DATABASE_URL="postgresql://one:one_password@postgres:5432/one_game?schema=public"
COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma:deploy && node dist/server/index.js"]
