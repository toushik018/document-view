FROM node:18.17-alpine

# Create app directory
WORKDIR /app

# Set environment variable
ENV NODE_ENV=production

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies with explicit CI mode and production=false
RUN npm config set progress=false && \
    npm config set loglevel=error && \
    npm ci --omit=dev --no-audit

# Copy app source
COPY . .

# Build the app
RUN npm run build

# Expose port
EXPOSE 5000

# Start the app
CMD ["node", "dist/index.js"] 