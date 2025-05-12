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

### Docker-based Deployment (Recommended)

1. Create a Railway account at https://railway.app
2. Click "New Project" in the Railway dashboard
3. Select "Deploy from GitHub repo"
4. Connect your GitHub repository
5. Railway will automatically detect the Dockerfile.railway specified in railway.json
6. Deploy the application

The Docker-based deployment uses:

- `Dockerfile.railway` - Multi-stage Docker build for Railway
- `.dockerignore` - Files to exclude from the container
- `railway.json` - Railway configuration

### Troubleshooting Railway Deployment

If you encounter build failures, try these steps:

1. In the Railway dashboard, go to your project settings
2. Make sure the "Watch" tab is enabled to see build logs
3. Try a clean build by clicking "Redeploy" and selecting "Clear build cache"
4. If Docker build still fails, contact Railway support and share your build logs

## Usage

1. On the sharing device, visit the application and grant camera permissions
2. On the viewing device, visit the `/watch` route to view the camera feed

## Environment Variables

- `NODE_ENV`: Set to `production` for production deployments
- `PORT`: (Optional) Port to run the server on, defaults to 5000

## Notes

- The application uses WebRTC, which works best over HTTPS
- For local development with external access, use a tool like ngrok
