# Use the official Node.js image as a base image
FROM node:23

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN pnpm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the Next.js application
CMD ["pnpm", "start"]
