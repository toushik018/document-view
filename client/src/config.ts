// Configuration for API endpoints
const config = {
    // API base URL - automatically detect environment
    apiUrl: process.env.NODE_ENV === 'production'
        ? 'https://your-railway-app.railway.app'  // REPLACE WITH YOUR ACTUAL RAILWAY URL ONCE DEPLOYED
        : 'http://localhost:5000',

    // WebSocket URL - automatically detect environment
    wsUrl: process.env.NODE_ENV === 'production'
        ? 'wss://your-railway-app.railway.app/ws'  // REPLACE WITH YOUR ACTUAL RAILWAY URL ONCE DEPLOYED
        : 'ws://localhost:5000/ws',

    // Other configuration options
    heartbeatInterval: 30000,  // 30 seconds
};

export default config; 