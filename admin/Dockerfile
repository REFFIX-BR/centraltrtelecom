# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:${NODE_VERSION}-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV ADMIN_API_HOST=0.0.0.0
ENV ADMIN_API_PORT=4050

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server

RUN mkdir -p server/uploads server/data

EXPOSE 4050
CMD ["npm", "run", "start"]
