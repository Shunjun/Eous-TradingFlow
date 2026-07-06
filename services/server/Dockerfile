FROM node:22-bookworm-slim

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY protos ./protos

RUN pnpm install --frozen-lockfile --prod=false

ENV NODE_ENV=production

EXPOSE 3020

CMD ["pnpm", "exec", "node", "--import", "tsx", "services/server/src/index.ts"]
