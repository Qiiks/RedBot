FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --no-frozen-lockfile

COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/worker apps/worker

CMD ["pnpm", "--filter", "@redbot/worker", "start"]
