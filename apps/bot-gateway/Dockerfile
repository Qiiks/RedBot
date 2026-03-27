FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/bot-gateway/package.json apps/bot-gateway/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/bot-gateway apps/bot-gateway

CMD ["pnpm", "--filter", "@redbot/bot-gateway", "start"]
