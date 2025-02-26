# Use the official Node.js image as a base image
FROM node:18-alpine

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Copy all project files first
COPY . . 

# Install dependencies
RUN pnpm install

# Build the Next.js application
RUN pnpm run build

# Ensure the .next directory is retained
RUN ls -la .next

# Expose the port the app runs on
EXPOSE 3000

# Start the Next.js application
CMD ["pnpm", "start"]
