FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ---- deps (semua, termasuk devDependencies untuk build) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile

# ---- builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack pnpm exec prisma generate
RUN corepack pnpm build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Install ulang hanya production dependencies langsung di image final —
# lebih andal daripada mengandalkan Next.js standalone file-tracing, yang
# terbukti tidak menyertakan dependency yang di-import secara dinamis
# (node-cron di instrumentation.ts, @prisma/adapter-pg di lib/prisma.ts).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile --prod

COPY --from=builder /app/prisma ./prisma
RUN corepack pnpm exec prisma generate

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000

CMD ["corepack", "pnpm", "start"]
