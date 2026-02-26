FROM node:20-bookworm-slim

WORKDIR /app

# Native build deps are required for some Strapi dependencies.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0

RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "start"]
