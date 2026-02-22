FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libc6 libvips42 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/parser/package.json packages/parser/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN yarn install --frozen-lockfile

COPY . .

RUN mkdir -p /app/apps/api/public/uploads

RUN yarn workspace api build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

EXPOSE 1337

CMD ["yarn", "start"]
