# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS panel
WORKDIR /app
ARG VITE_ADMIN_API_URL=https://centralapi.trtelecom.net
ENV VITE_ADMIN_API_URL=$VITE_ADMIN_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY src ./src
RUN npx vite build

FROM node:${NODE_VERSION}-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV ADMIN_API_HOST=0.0.0.0
ENV ADMIN_API_PORT=4050

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=panel /app/dist ./dist

RUN mkdir -p server/uploads server/data

EXPOSE 4050
CMD ["npm", "run", "start"]
