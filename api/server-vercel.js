// Vercel API Handler for Serverless Functions
export default function handler(req, res) {
    res.status(200).json({
        message: "This is a static deployment of the frontend only. The backend WebSocket functionality requires Railway or another server environment.",
        status: "static-frontend-only",
        serverless: true
    });
} 