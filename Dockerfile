FROM dhi.io/bun:1-dev AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM dhi.io/node:24 AS production

WORKDIR /app

ENV NODE_ENV=production \
    PORT=44100 \
    MIGRATE_ON_START=true

COPY --from=builder --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 package.json remix.json tsconfig.json server.ts ./
COPY --chown=1000:1000 app ./app
COPY --chown=1000:1000 db ./db
COPY --chown=1000:1000 public ./public

USER 1000:1000

EXPOSE 44100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/healthz`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "--import", "remix/node-tsx", "server.ts"]
