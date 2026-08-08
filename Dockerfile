# Huy Locket — Railway web: build frontend from current source, then serve with server.mjs
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Railway injects this build arg for GitHub-triggered deployments.
# Declaring it makes the exact source commit available to write-version.mjs
# without installing git in the image.
ARG RAILWAY_GIT_COMMIT_SHA

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:deploy

FROM node:24-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY --from=build /app/public ./public
COPY server.mjs ./server.mjs

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.mjs"]
