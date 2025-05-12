import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";

// Import full ws module
import * as ws from 'ws';

// Constants for WebSocket ready state
const OPEN = 1; // Standard WebSocket OPEN state

type Client = {
  id: string;
  socket: ws.WebSocket;
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
  
  console.log('WebSocket server created and waiting for connections');
  
  wss.on('connection', (socket: ws.WebSocket) => {
    console.log('New WebSocket connection established');
    const clientId = nanoid();
    
    // Wait for initial message to determine client type
    socket.on('message', async (message: ws.RawData) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message type: ${data.type} from client ${clientId}`);
        
        if (data.type === 'register') {
          // Register client based on role
          if (data.role === 'sharer') {
            console.log(`Registering client ${clientId} as sharer`);
            // Store this client as the sharer
            const client: Client = { id: clientId, socket, type: 'sharer' };
            clients.set(clientId, client);
            currentSharer = client;
            
            // Notify all watchers that a sharer is available
            for (const [id, client] of clients.entries()) {
              if (client.type === 'watcher' && client.socket.readyState === OPEN) {
                console.log(`Notifying watcher ${id} that sharer is available`);
                client.socket.send(JSON.stringify({ type: 'sharer-connected' }));
              }
            }
            
            // Acknowledge registration
            socket.send(JSON.stringify({ type: 'registered', id: clientId }));
          } else if (data.role === 'watcher') {
            console.log(`Registering client ${clientId} as watcher`);
            // Store this client as a watcher
            const client: Client = { id: clientId, socket, type: 'watcher' };
            clients.set(clientId, client);
            
            const isSharerAvailable = currentSharer !== null && 
                                     currentSharer.socket.readyState === OPEN;
            
            console.log(`Acknowledging watcher registration, sharer available: ${isSharerAvailable}`);
            // Acknowledge registration
            socket.send(JSON.stringify({ 
              type: 'registered', 
              id: clientId,
              sharerAvailable: isSharerAvailable
            }));
          }
        } else if (data.type === 'offer') {
          console.log('Received offer from sharer, forwarding to watchers');
          // Forward offer to all watchers
          for (const [id, client] of clients.entries()) {
            if (client.type === 'watcher' && client.socket.readyState === OPEN) {
              console.log(`Forwarding offer to watcher ${id}`);
              client.socket.send(JSON.stringify({
                type: 'offer',
                offer: data.offer
              }));
            }
          }
        } else if (data.type === 'answer') {
          console.log(`Received answer from watcher ${clientId}, forwarding to sharer`);
          // Forward answer to the sharer
          if (currentSharer && currentSharer.socket.readyState === OPEN) {
            currentSharer.socket.send(JSON.stringify({
              type: 'answer',
              answer: data.answer,
              from: clientId
            }));
          } else {
            console.log('No active sharer available to receive answer');
          }
        } else if (data.type === 'ice-candidate') {
          // Handle ICE candidate exchange
          if (data.target === 'sharer' && currentSharer && 
              currentSharer.socket.readyState === OPEN) {
            // Send to sharer
            console.log(`Forwarding ICE candidate from ${clientId} to sharer`);
            currentSharer.socket.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: data.candidate,
              from: clientId
            }));
          } else if (data.target === 'watcher') {
            // Send to specific watcher or broadcast to all watchers if no specific target
            if (data.to) {
              const watcher = clients.get(data.to);
              if (watcher && watcher.socket.readyState === OPEN) {
                console.log(`Forwarding ICE candidate to specific watcher ${data.to}`);
                watcher.socket.send(JSON.stringify({
                  type: 'ice-candidate',
                  candidate: data.candidate,
                  from: clientId
                }));
              }
            } else {
              // If no specific target, send to all watchers (broadcast)
              console.log('Broadcasting ICE candidate to all watchers');
              for (const [id, client] of clients.entries()) {
                if (client.type === 'watcher' && client.socket.readyState === OPEN) {
                  client.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: data.candidate,
                    from: clientId
                  }));
                }
              }
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
      console.log(`Client ${clientId} disconnected`);
      const client = clients.get(clientId);
      if (client) {
        if (client.type === 'sharer' && currentSharer && currentSharer.id === clientId) {
          console.log('Sharer disconnected, notifying all watchers');
          // Notify all watchers that the sharer is disconnected
          for (const [id, client] of clients.entries()) {
            if (client.type === 'watcher' && client.socket.readyState === OPEN) {
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
                            currentSharer.socket.readyState === OPEN;
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
