# ---- Dependencies ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# DATABASE_URL is only needed at runtime; a dummy satisfies the build without
# persisting in the image as an env var (build args don't persist in layers).
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN DATABASE_URL="$DATABASE_URL" npm run build

# ---- Runner ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Chromium (+ HarfBuzz for correct Persian shaping) for server-side invoice PDFs.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV CHROMIUM_PATH=/usr/bin/chromium PUPPETEER_SKIP_DOWNLOAD=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Full node_modules so the Prisma CLI (`migrate deploy`) and the admin bootstrap
# have every dependency they need (the Next standalone trace omits CLI-only deps).
# Copied AFTER the standalone output so it supersedes the slim traced copy.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# One-time maintenance scripts (factor-name import, ownership reassign) run via
# `docker compose exec app node scripts/<name>.mjs`.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["./docker-entrypoint.sh"]
