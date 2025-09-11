# syntax=docker/dockerfile:1

# ----- Build stage -----
FROM node:18-alpine AS build
WORKDIR /app

# Install OS deps (if needed)
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source
COPY tsconfig.json tsconfig.test.json .eslintrc.js .prettierrc jest.config.js knexfile.ts ./
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds

# Build TypeScript
RUN npm run build

# ----- Runtime stage -----
FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy runtime bundles
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/seeds ./seeds

# Entrypoint for running migrations then starting the app
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Default command runs the API server; override in compose for worker
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/server.js"]
