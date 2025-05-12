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

## Deployment Options

### Deploy to Render

1. Create a Render account at https://render.com
2. Connect your GitHub/GitLab repository
3. Click "New Web Service"
4. Select your repository
5. Configure the service:
   - Name: secretcamerastream (or your preferred name)
   - Environment: Node
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
   - Add environment variable: `NODE_ENV` = `production`
6. Click "Create Web Service"

Alternatively, you can use the provided `render.yaml` file for Blueprint deployment:

1. Go to https://render.com/docs/blueprint-spec
2. Follow instructions to deploy using the YAML configuration

### Deploy to Railway

1. Create a Railway account at https://railway.app
2. Click "New Project" and select "Deploy from GitHub repo"
3. Configure the deployment:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
   - Add environment variable: `NODE_ENV` = `production`
4. Deploy the application

### Deploy to DigitalOcean App Platform

1. Create a DigitalOcean account
2. Go to App Platform and click "Create App"
3. Connect your GitHub repository
4. Configure the deployment:
   - Build Command: `npm ci && npm run build`
   - Run Command: `npm run start`
   - Add environment variable: `NODE_ENV` = `production`
5. Deploy the application

## Environment Variables

- `NODE_ENV`: Set to `production` for production deployments
- `PORT`: (Optional) Port to run the server on, defaults to 5000

## Usage

1. On the sharing device, visit the application and grant camera permissions
2. On the viewing device, visit the `/watch` route to view the camera feed

## Notes

- The application uses WebRTC, which works best over HTTPS
- For local development with external access, use a tool like ngrok
