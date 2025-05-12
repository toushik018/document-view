import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";

type Client = {
  id: string;
  socket: WebSocket;
  type: "sharer" | "watcher";
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create WebSocket server for signaling
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track connected clients
  const clients: Map<string, Client> = new Map();
  
  // The current active sharer (we only support one at a time for this app)
  let currentSharer: Client | null = null;
  
  wss.on('connection', (socket: WebSocket) => {
    const clientId = nanoid();
    
    // Wait for initial message to determine client type
    socket.on('message', async (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'register') {
          // Register client based on role
          if (data.role === 'sharer') {
            // Store this client as the sharer
            const client: Client = { id: clientId, socket, type: 'sharer' };
            clients.set(clientId, client);
            currentSharer = client;
            
            // Notify all watchers that a sharer is available
            for (const [id, client] of clients.entries()) {
              if (client.type === 'watcher' && client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(JSON.stringify({ type: 'sharer-connected' }));
              }
            }
            
            // Acknowledge registration
            socket.send(JSON.stringify({ type: 'registered', id: clientId }));
          } else if (data.role === 'watcher') {
            // Store this client as a watcher
            const client: Client = { id: clientId, socket, type: 'watcher' };
            clients.set(clientId, client);
            
            // Acknowledge registration
            socket.send(JSON.stringify({ 
              type: 'registered', 
              id: clientId,
              sharerAvailable: currentSharer !== null && 
                               currentSharer.socket.readyState === WebSocket.OPEN
            }));
          }
        } else if (data.type === 'offer') {
          // Forward offer to all watchers
          for (const [id, client] of clients.entries()) {
            if (client.type === 'watcher' && client.socket.readyState === WebSocket.OPEN) {
              client.socket.send(JSON.stringify({
                type: 'offer',
                offer: data.offer
              }));
            }
          }
        } else if (data.type === 'answer') {
          // Forward answer to the sharer
          if (currentSharer && currentSharer.socket.readyState === WebSocket.OPEN) {
            currentSharer.socket.send(JSON.stringify({
              type: 'answer',
              answer: data.answer,
              from: clientId
            }));
          }
        } else if (data.type === 'ice-candidate') {
          // Handle ICE candidate exchange
          if (data.target === 'sharer' && currentSharer && 
              currentSharer.socket.readyState === WebSocket.OPEN) {
            // Send to sharer
            currentSharer.socket.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: data.candidate,
              from: clientId
            }));
          } else if (data.target === 'watcher') {
            // Send to specific watcher
            const watcher = clients.get(data.to);
            if (watcher && watcher.socket.readyState === WebSocket.OPEN) {
              watcher.socket.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: data.candidate,
                from: clientId
              }));
            }
          }
        } else if (data.type === 'heartbeat') {
          // Respond to heartbeat
          socket.send(JSON.stringify({ type: 'heartbeat-ack' }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle disconnect
    socket.on('close', () => {
      const client = clients.get(clientId);
      if (client) {
        if (client.type === 'sharer' && currentSharer && currentSharer.id === clientId) {
          // Notify all watchers that the sharer is disconnected
          for (const [id, client] of clients.entries()) {
            if (client.type === 'watcher' && client.socket.readyState === WebSocket.OPEN) {
              client.socket.send(JSON.stringify({ type: 'sharer-disconnected' }));
            }
          }
          currentSharer = null;
        }
        
        // Remove client from map
        clients.delete(clientId);
      }
    });
  });
  
  // API routes for statistics and status (optional for later expansion)
  app.get('/api/status', (req, res) => {
    const sharerConnected = currentSharer !== null && 
                            currentSharer.socket.readyState === WebSocket.OPEN;
    const watcherCount = Array.from(clients.values())
      .filter(client => client.type === 'watcher')
      .length;
      
    res.json({
      sharerConnected,
      watcherCount
    });
  });

  return httpServer;
}
