# Use official Node.js image as base
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (to leverage Docker cache)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the Next.js app
RUN pnpm run build

# Use a lightweight image for serving the built app
FROM node:18-alpine

WORKDIR /app

# Copy built files from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Start the Next.js production server
CMD ["pnpm", "run", "start"]
