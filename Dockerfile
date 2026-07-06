FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
RUN pnpm install --frozen-lockfile

FROM deps AS web-builder
RUN pnpm --filter @eous/web build

FROM nginx:1.27-alpine AS web-runner
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
