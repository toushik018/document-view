# SecretCameraStream

A private camera streaming application that enables seamless sharing of camera feed between devices using WebRTC technology.

## Features

- Real-time camera streaming via WebRTC
- Persistent connection even when minimized/backgrounded
- Low-latency peer-to-peer video transfer
- Multiple viewers support
- Simple and intuitive UI

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Deployment to Railway

### Method 1: Using Railway CLI

1. Install the Railway CLI:

   ```bash
   npm i -g @railway/cli
   ```

2. Login to Railway:

   ```bash
   railway login
   ```

3. Initialize your project:

   ```bash
   railway init
   ```

4. Deploy your project:
   ```bash
   railway up
   ```

### Method 2: Using Railway Dashboard

1. Create a Railway account at https://railway.app
2. Install the Railway CLI and login (optional but recommended)
3. Click "New Project" in the Railway dashboard
4. Select "Deploy from GitHub repo"
5. Connect your GitHub repository
6. Railway will use our configuration files:
   - `railway.toml` - Railway project configuration
   - `nixpacks.toml` - Build environment configuration
   - `build.sh` - Custom build script
   - `.npmrc` - NPM configuration to ensure dependencies are installed correctly
7. Deploy the application

### Troubleshooting Railway Deployment

If you encounter build failures, try these steps:

1. In the Railway dashboard, go to your project settings
2. Under Environment, add the variable `NODE_ENV=production`
3. Make sure the "Watch" tab is enabled to see build logs
4. If needed, force a clean build by clicking "Redeploy" and selecting "Clear build cache"

## Usage

1. On the sharing device, visit the application and grant camera permissions
2. On the viewing device, visit the `/watch` route to view the camera feed

## Environment Variables

- `NODE_ENV`: Set to `production` for production deployments
- `PORT`: (Optional) Port to run the server on, defaults to 5000

## Notes

- The application uses WebRTC, which works best over HTTPS
- For local development with external access, use a tool like ngrok
