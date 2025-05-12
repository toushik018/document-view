FROM node:18.17-alpine

# Create app directory
WORKDIR /app

# Set environment variable
ENV NODE_ENV=production

# Copy package files first for better layer caching
COPY package*.json ./

# Clean install without using cache
RUN npm config set progress=false && \
    npm config set cache /tmp/npm-cache && \
    npm ci

# Copy app source
COPY . .

# Build the app
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --production

# Expose port
EXPOSE 5000

# Start the app
CMD ["node", "dist/index.js"] 