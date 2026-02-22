FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/parser/package.json packages/parser/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn workspace web build

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "yarn start -H 0.0.0.0 -p ${PORT:-3000}"]
