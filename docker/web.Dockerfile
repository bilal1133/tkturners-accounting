FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/parser/package.json packages/parser/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN yarn install --frozen-lockfile

COPY . .

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["yarn", "dev", "-p", "3000"]
