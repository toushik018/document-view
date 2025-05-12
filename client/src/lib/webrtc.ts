// WebRTC Implementation with simplified approach
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let wsConnection: WebSocket | null = null;
let clientType: 'sharer' | 'watcher' | null = null;
let clientId: string | null = null;
let reconnectAttempts = 0;
let reconnectInterval: NodeJS.Timeout | null = null;
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
  console.log("Initializing WebRTC as sharer");
  localStream = stream;
  clientType = type;
  
  // Add global event listener for when page is about to unload
  window.addEventListener('beforeunload', cleanupResources);
  
  connectWebSocket();
}

// Connect to WebRTC as a watcher
export function connectToWebRTC(
  type: 'watcher', 
  callback: (stream: MediaStream | null, error?: string) => void
) {
  console.log("Connecting WebRTC as watcher");
  clientType = type;
  
  // Add global event listener for when page is about to unload
  window.addEventListener('beforeunload', cleanupResources);
  
  connectWebSocket(callback);
}

// Cleanup function for resources
function cleanupResources() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }

  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.close();
  }
  wsConnection = null;

  if (peerConnection) {
    peerConnection.close();
  }
  peerConnection = null;

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  localStream = null;
}

// Disconnect WebRTC
export function disconnectWebRTC() {
  console.log("Disconnecting WebRTC");
  window.removeEventListener('beforeunload', cleanupResources);
  cleanupResources();
  clientType = null;
  clientId = null;
  reconnectAttempts = 0;
}

// Connect to the signaling server via WebSocket
function connectWebSocket(callback?: (stream: MediaStream | null, error?: string) => void) {
  if (wsConnection) {
    console.log("Closing existing WebSocket before creating new one");
    wsConnection.close();
    wsConnection = null;
  }

  // Create WebSocket connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log(`Connecting to WebSocket at ${wsUrl}`);
  wsConnection = new WebSocket(wsUrl);
  
  wsConnection.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0;
    
    // Register client type with the server
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({
        type: 'register',
        role: clientType
      }));
      
      // Start heartbeat to keep connection alive
      startHeartbeat();
    }
  };
  
  wsConnection.onclose = (event) => {
    console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
    
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    // Try to reconnect if it wasn't a normal closure
    if (event.code !== 1000 && reconnectAttempts < 5) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
      
      if (reconnectInterval) clearInterval(reconnectInterval);
      
      reconnectInterval = setTimeout(() => {
        reconnectAttempts++;
        connectWebSocket(callback);
      }, delay);
    } else if (callback && clientType === 'watcher') {
      callback(null, 'WebSocket connection closed');
    }
  };
  
  wsConnection.onerror = (error) => {
    console.error('WebSocket error:', error);
    
    // WebSocket errors will trigger the onclose event, which will handle reconnection
    if (callback && clientType === 'watcher') {
      callback(null, 'WebSocket connection error');
    }
  };
  
  wsConnection.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('WebSocket message received:', message.type);
      
      switch (message.type) {
        case 'registered':
          // Store client ID
          clientId = message.id;
          console.log(`Registered as ${clientType} with ID: ${clientId}`);
          
          // If sharer, create and send offer
          if (clientType === 'sharer') {
            console.log("Creating sharer peer connection after registration");
            createSharerPeerConnection();
          }
          
          // If watcher and sharer is available, prepare for connection
          if (clientType === 'watcher' && message.sharerAvailable) {
            console.log("Creating watcher peer connection - sharer is available");
            createWatcherPeerConnection(callback);
          } else if (clientType === 'watcher' && !message.sharerAvailable) {
            console.log("No active sharer found");
            if (callback) {
              callback(null, 'No active camera found. Please ensure a camera is being shared.');
            }
          }
          break;
          
        case 'sharer-connected':
          // Sharer just connected, create peer connection
          if (clientType === 'watcher') {
            console.log("Sharer just connected, creating peer connection");
            createWatcherPeerConnection(callback);
          }
          break;
          
        case 'sharer-disconnected':
          // Sharer disconnected
          console.log("Sharer disconnected");
          if (clientType === 'watcher' && callback) {
            callback(null, 'Camera feed disconnected');
          }
          break;
          
        case 'offer':
          // Handle offer (for watcher)
          if (clientType === 'watcher') {
            console.log("Received offer from sharer");
            handleReceivedOffer(message.offer, callback);
          }
          break;
          
        case 'answer':
          // Handle answer (for sharer)
          if (clientType === 'sharer') {
            console.log("Received answer from watcher");
            handleReceivedAnswer(message.answer);
          }
          break;
          
        case 'ice-candidate':
          // Handle ICE candidate
          console.log("Received ICE candidate");
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
          
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  };
}

// Create Peer Connection for the sharer
function createSharerPeerConnection() {
  if (peerConnection) {
    console.log("Closing existing peer connection before creating a new one");
    peerConnection.close();
  }
  
  // Create new peer connection
  peerConnection = new RTCPeerConnection(iceServers);
  console.log("Sharer peer connection created");
  
  // Add local tracks to peer connection
  if (localStream) {
    console.log(`Adding ${localStream.getTracks().length} tracks to the peer connection`);
    localStream.getTracks().forEach(track => {
      if (peerConnection && localStream) {
        peerConnection.addTrack(track, localStream);
      }
    });
  } else {
    console.error("No local stream to add to peer connection");
    return;
  }
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      console.log("Sending ICE candidate to watchers");
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: 'watcher'
      }));
    } else if (!event.candidate) {
      console.log("ICE candidate gathering completed");
    }
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state changed to: ${peerConnection?.iceGatheringState}`);
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state changed to: ${peerConnection?.iceConnectionState}`);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state changed to: ${peerConnection?.connectionState}`);
  };
  
  // Create and send offer
  peerConnection.createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: true  // Enable audio
  }).then(offer => {
    if (peerConnection) {
      return peerConnection.setLocalDescription(offer);
    }
  }).then(() => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN && peerConnection?.localDescription) {
      console.log("Sending offer to watchers");
      wsConnection.send(JSON.stringify({
        type: 'offer',
        offer: peerConnection.localDescription
      }));
    } else {
      console.error("Cannot send offer: WebSocket not open or no local description");
    }
  }).catch(err => {
    console.error("Error creating or sending offer:", err);
  });
}

// Create Peer Connection for the watcher
function createWatcherPeerConnection(
  callback?: (stream: MediaStream | null, error?: string) => void
) {
  if (peerConnection) {
    console.log("Closing existing peer connection before creating a new one");
    peerConnection.close();
  }
  
  // Create new peer connection
  peerConnection = new RTCPeerConnection(iceServers);
  console.log("Watcher peer connection created");
  
  // Set up track handler to receive remote stream
  peerConnection.ontrack = (event) => {
    console.log("Received remote track:", event.track.kind);
    if (callback && event.streams && event.streams.length > 0) {
      console.log("Sending remote stream to callback");
      callback(event.streams[0]);
    }
  };
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      console.log("Sending ICE candidate to sharer");
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: 'sharer'
      }));
    } else if (!event.candidate) {
      console.log("ICE candidate gathering completed");
    }
  };
  
  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state changed to: ${peerConnection?.iceGatheringState}`);
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state changed to: ${peerConnection?.iceConnectionState}`);
    
    if (peerConnection?.iceConnectionState === 'disconnected' ||
        peerConnection?.iceConnectionState === 'failed') {
      console.log("ICE connection failed or disconnected");
      if (callback) {
        callback(null, `Connection lost: ${peerConnection.iceConnectionState}`);
      }
    }
  };
  
  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state changed to: ${peerConnection?.connectionState}`);
    
    if (peerConnection?.connectionState === 'disconnected' ||
        peerConnection?.connectionState === 'failed') {
      console.log("Connection failed or disconnected");
      if (callback) {
        callback(null, `Connection lost: ${peerConnection.connectionState}`);
      }
    }
  };
}

// Handle received offer (for watcher)
function handleReceivedOffer(
  offer: RTCSessionDescriptionInit,
  callback?: (stream: MediaStream | null, error?: string) => void
) {
  if (!peerConnection) {
    console.log("Creating new peer connection to handle offer");
    createWatcherPeerConnection(callback);
  }
  
  if (peerConnection) {
    console.log("Setting remote description (offer)");
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        console.log("Creating answer");
        return peerConnection!.createAnswer();
      })
      .then(answer => {
        console.log("Setting local description (answer)");
        return peerConnection!.setLocalDescription(answer);
      })
      .then(() => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN && peerConnection?.localDescription) {
          console.log("Sending answer to sharer");
          wsConnection.send(JSON.stringify({
            type: 'answer',
            answer: peerConnection.localDescription
          }));
        } else {
          console.error("Cannot send answer: WebSocket not open or no local description");
        }
      })
      .catch(err => {
        console.error("Error handling offer:", err);
        if (callback) {
          callback(null, `Error setting up connection: ${err.message}`);
        }
      });
  }
}

// Handle received answer (for sharer)
function handleReceivedAnswer(answer: RTCSessionDescriptionInit) {
  if (peerConnection) {
    console.log("Setting remote description (answer)");
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .catch(err => {
        console.error("Error setting remote description:", err);
      });
  } else {
    console.error("No peer connection to handle answer");
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
  }, 15000); // Send heartbeat every 15 seconds
}
