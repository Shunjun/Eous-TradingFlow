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
RUN pnpm --filter @eous/db db:generate

ENV NODE_ENV=production

EXPOSE 3020

CMD ["pnpm", "--filter", "@eous/server", "exec", "node", "--import", "tsx", "src/index.ts"]
