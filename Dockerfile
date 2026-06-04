ARG NODE_VERSION=24.16.0-alpine

FROM node:${NODE_VERSION} AS base

# Set working directory
WORKDIR /app

COPY package.json package-lock.json* ./

COPY . .

RUN npm ci --omit=dev

EXPOSE 3000

CMD ["node", "server.js"]
