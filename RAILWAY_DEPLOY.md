# Railway Deployment Guide

This guide will help you deploy the WebSocket backend to Railway.

## Prerequisites

1. A Railway account (sign up at [railway.app](https://railway.app))
2. Railway CLI installed (`npm install -g @railway/cli`)

## Deployment Steps

### Option 1: Deploy via Railway CLI

1. Login to Railway:

   ```
   railway login
   ```

2. Initialize a new project (if you haven't already):

   ```
   railway init
   ```

3. Set up your environment variables:

   ```
   railway vars set NODE_ENV=production
   railway vars set PORT=8080
   ```

4. Deploy your project:
   ```
   railway up
   ```

### Option 2: Deploy via GitHub Integration

1. Push your code to GitHub
2. Login to [Railway Dashboard](https://railway.app/dashboard)
3. Click "New Project" > "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect the Nixpacks configuration

## After Deployment

1. Get your deployment URL from the Railway dashboard
2. Update the frontend configuration in `client/src/config.ts` with your Railway URL
3. Redeploy the frontend to Vercel

## Connecting Frontend to Backend

Once deployed, you'll need to update the frontend config with your Railway URL:

```typescript
// In client/src/config.ts
const config = {
  apiUrl: "https://your-railway-app.railway.app",
  wsUrl: "wss://your-railway-app.railway.app/ws",
  // ...
};
```

## Troubleshooting

If you encounter any deployment issues:

1. Check Railway logs: `railway logs`
2. Ensure all environment variables are set correctly
3. Check that the PORT environment variable matches the one in your code
4. Verify your nixpacks.toml configuration

## Monitoring

Railway provides built-in monitoring and logging. Access them from your project dashboard.
