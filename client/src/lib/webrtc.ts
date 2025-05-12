// WebRTC Implementation
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let wsConnection: WebSocket | null = null;
let clientType: 'sharer' | 'watcher' | null = null;
let clientId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ICE servers configuration for STUN/TURN
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
};

// Initialize WebRTC for a sharer
export function initializeWebRTC(stream: MediaStream, type: 'sharer') {
  localStream = stream;
  clientType = type;
  connectWebSocket();
}

// Connect to WebRTC as a watcher
export function connectToWebRTC(
  type: 'watcher', 
  callback: (stream: MediaStream | null, error?: string) => void
) {
  clientType = type;
  connectWebSocket(callback);
}

// Disconnect WebRTC
export function disconnectWebRTC() {
  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Close WebSocket
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }

  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Release local media if it's a sharer
  if (clientType === 'sharer' && localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  clientType = null;
  clientId = null;
}

// Connect to the signaling server via WebSocket
function connectWebSocket(callback?: (stream: MediaStream | null, error?: string) => void) {
  // Create WebSocket connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  wsConnection = new WebSocket(wsUrl);
  
  wsConnection.onopen = () => {
    console.log('WebSocket connection established');
    
    // Register client type with the server
    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'register',
        role: clientType
      }));
    }
    
    // Start heartbeat to keep connection alive
    startHeartbeat();
  };
  
  wsConnection.onclose = () => {
    console.log('WebSocket connection closed');
    
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    // Notify callback if provided
    if (callback && clientType === 'watcher') {
      callback(null, 'WebSocket connection closed');
    }
  };
  
  wsConnection.onerror = (error) => {
    console.error('WebSocket error:', error);
    
    // Notify callback if provided
    if (callback && clientType === 'watcher') {
      callback(null, 'WebSocket connection error');
    }
  };
  
  wsConnection.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'registered':
          // Store client ID
          clientId = message.id;
          
          // If sharer, create and send offer
          if (clientType === 'sharer') {
            await createSharerPeerConnection();
          }
          
          // If watcher and sharer is available, prepare for connection
          if (clientType === 'watcher' && message.sharerAvailable) {
            await createWatcherPeerConnection(callback);
          } else if (clientType === 'watcher' && !message.sharerAvailable) {
            if (callback) {
              callback(null, 'No active camera found. Please ensure a camera is being shared.');
            }
          }
          break;
          
        case 'sharer-connected':
          // Sharer just connected, create peer connection
          if (clientType === 'watcher') {
            await createWatcherPeerConnection(callback);
          }
          break;
          
        case 'sharer-disconnected':
          // Sharer disconnected
          if (clientType === 'watcher' && callback) {
            callback(null, 'Camera feed disconnected');
          }
          break;
          
        case 'offer':
          // Handle offer (for watcher)
          if (clientType === 'watcher' && peerConnection) {
            await handleReceivedOffer(message.offer, callback);
          }
          break;
          
        case 'answer':
          // Handle answer (for sharer)
          if (clientType === 'sharer' && peerConnection) {
            await handleReceivedAnswer(message.answer);
          }
          break;
          
        case 'ice-candidate':
          // Handle ICE candidate
          if (peerConnection) {
            try {
              await peerConnection.addIceCandidate(message.candidate);
            } catch (e) {
              console.error('Error adding received ice candidate', e);
            }
          }
          break;
          
        case 'heartbeat-ack':
          // Heartbeat acknowledgement, no action needed
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  };
}

// Create Peer Connection for the sharer
async function createSharerPeerConnection() {
  // Create new peer connection
  peerConnection = new RTCPeerConnection(iceServers);
  
  // Add local tracks to peer connection
  if (localStream) {
    localStream.getTracks().forEach(track => {
      if (peerConnection && localStream) {
        peerConnection.addTrack(track, localStream);
      }
    });
  }
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: 'watcher'
      }));
    }
  };
  
  // Create and send offer
  const offer = await peerConnection.createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: false // No audio in this application
  });
  
  await peerConnection.setLocalDescription(offer);
  
  if (wsConnection) {
    wsConnection.send(JSON.stringify({
      type: 'offer',
      offer: offer
    }));
  }
}

// Create Peer Connection for the watcher
async function createWatcherPeerConnection(
  callback?: (stream: MediaStream | null, error?: string) => void
) {
  // Create new peer connection
  peerConnection = new RTCPeerConnection(iceServers);
  
  // Set up track handler to receive remote stream
  peerConnection.ontrack = (event) => {
    if (callback) {
      callback(event.streams[0]);
    }
  };
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: 'sharer'
      }));
    }
  };
  
  // Connection state change handling
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection?.connectionState === 'disconnected' ||
        peerConnection?.connectionState === 'failed') {
      if (callback) {
        callback(null, `Connection state: ${peerConnection.connectionState}`);
      }
    }
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection?.iceConnectionState === 'disconnected' ||
        peerConnection?.iceConnectionState === 'failed') {
      if (callback) {
        callback(null, `ICE connection state: ${peerConnection.iceConnectionState}`);
      }
    }
  };
}

// Handle received offer (for watcher)
async function handleReceivedOffer(
  offer: RTCSessionDescriptionInit,
  callback?: (stream: MediaStream | null, error?: string) => void
) {
  if (!peerConnection) {
    // Create peer connection if it doesn't exist
    await createWatcherPeerConnection(callback);
  }
  
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send answer to sharer
    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'answer',
        answer: answer
      }));
    }
  }
}

// Handle received answer (for sharer)
async function handleReceivedAnswer(answer: RTCSessionDescriptionInit) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

// Start heartbeat to keep WebSocket connection alive
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, 30000); // Send heartbeat every 30 seconds
}
