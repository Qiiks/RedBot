FROM node:20-slim

WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY pnpm-lock.yaml ./
COPY apps/bot-gateway/package.json apps/bot-gateway/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/bot-gateway apps/bot-gateway

RUN pnpm --filter @redbot/db prisma:generate

CMD ["pnpm", "--filter", "@redbot/bot-gateway", "start"]
