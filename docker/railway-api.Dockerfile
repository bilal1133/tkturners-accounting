FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat vips

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/parser/package.json packages/parser/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn workspace api build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

EXPOSE 1337

CMD ["yarn", "start"]
