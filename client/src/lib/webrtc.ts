// Simplified WebRTC Implementation
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let wsConnection: WebSocket | null = null;
let clientType: 'sharer' | 'watcher' | null = null;
let clientId: string | null = null;
let reconnectAttempts = 0;
let reconnectInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ICE servers configuration - Using multiple STUN servers for better connectivity
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
};

// Initialize WebRTC for a sharer (camera provider)
export function initializeWebRTC(stream: MediaStream, type: 'sharer') {
  console.log("Initializing as camera source");
  localStream = stream;
  clientType = type;

  // Add cleanup handler for page unload
  window.addEventListener('beforeunload', cleanupResources);

  // Connect to WebSocket server
  connectWebSocket();
}

// Connect to WebRTC as a watcher (viewer)
export function connectToWebRTC(
  type: 'watcher',
  callback: (stream: MediaStream | null, error?: string) => void
) {
  console.log("Connecting as camera viewer");
  clientType = type;

  // Add cleanup handler for page unload
  window.addEventListener('beforeunload', cleanupResources);

  // Connect to WebSocket server
  connectWebSocket(callback);
}

// Cleanup all resources
function cleanupResources() {
  console.log("Cleaning up resources");

  // Clear all intervals
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }

  // Close WebSocket
  if (wsConnection && wsConnection.readyState === 1) { // 1 = OPEN
    wsConnection.close();
  }
  wsConnection = null;

  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
  }
  peerConnection = null;

  // Stop media tracks
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
  // Close existing connection if any
  if (wsConnection) {
    console.log("Closing existing WebSocket connection");
    wsConnection.close();
    wsConnection = null;
  }

  // Create a new WebSocket connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  console.log(`Connecting to WebSocket at ${wsUrl}`);
  wsConnection = new WebSocket(wsUrl);

  // Make the WebSocket connection available globally for the header component
  (window as any).wsConnection = wsConnection;

  // Connection established handler
  wsConnection.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0;

    // Register client type with the server
    if (wsConnection && wsConnection.readyState === 1) { // 1 = OPEN
      wsConnection.send(JSON.stringify({
        type: 'register',
        role: clientType
      }));

      // Start heartbeat to keep connection alive
      startHeartbeat();
    }
  };

  // Connection closed handler
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

  // Connection error handler
  wsConnection.onerror = (error) => {
    console.error('WebSocket error:', error);

    // WebSocket errors will trigger the onclose event, which will handle reconnection
    if (callback && clientType === 'watcher') {
      callback(null, 'WebSocket connection error');
    }
  };

  // Message handler
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
            console.log("Creating camera sender connection");
            createSharerPeerConnection();
          }

          // If watcher and sharer is available, prepare for connection
          if (clientType === 'watcher' && message.sharerAvailable) {
            console.log("Creating camera receiver connection");
            createWatcherPeerConnection(callback);
          } else if (clientType === 'watcher' && !message.sharerAvailable) {
            console.log("No active camera found");
            if (callback) {
              callback(null, 'No active camera found. Please ensure a camera is being shared.');
            }
          }
          break;

        case 'sharer-connected':
          // Sharer just connected, create peer connection
          if (clientType === 'watcher') {
            console.log("Camera source connected, creating receiver connection");
            createWatcherPeerConnection(callback);
          }
          break;

        case 'sharer-disconnected':
          // Sharer disconnected
          console.log("Camera source disconnected");
          if (clientType === 'watcher' && callback) {
            callback(null, 'Camera feed disconnected');
          }
          break;

        case 'offer':
          // Handle offer (for watcher)
          if (clientType === 'watcher') {
            console.log("Received offer from camera source");
            handleReceivedOffer(message.offer, callback);
          }
          break;

        case 'answer':
          // Handle answer (for sharer)
          if (clientType === 'sharer') {
            console.log("Received answer from viewer");
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

// Create Peer Connection for the sharer (camera source)
function createSharerPeerConnection() {
  if (peerConnection) {
    console.log("Closing existing peer connection before creating a new one");
    peerConnection.close();
  }

  // Create new peer connection with ICE servers
  peerConnection = new RTCPeerConnection(iceServers);
  console.log("Camera source peer connection created");

  // Add all tracks from local stream to the peer connection
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
    if (event.candidate && wsConnection && wsConnection.readyState === 1) { // 1 = OPEN
      console.log("Sending ICE candidate to viewers");
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: 'watcher'
      }));
    } else if (!event.candidate) {
      console.log("ICE candidate gathering completed");
    }
  };

  // Log state changes for debugging
  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state changed to: ${peerConnection?.iceGatheringState}`);
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state changed to: ${peerConnection?.iceConnectionState}`);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state changed to: ${peerConnection?.connectionState}`);
  };

  // Create and send offer with less constraints
  const offerOptions = {
    offerToReceiveVideo: true,
    offerToReceiveAudio: true
  };

  peerConnection.createOffer(offerOptions)
    .then(offer => {
      if (peerConnection) {
        console.log("Setting local description (offer)");
        return peerConnection.setLocalDescription(offer);
      }
    })
    .then(() => {
      if (wsConnection && wsConnection.readyState === 1 && peerConnection?.localDescription) { // 1 = OPEN
        console.log("Sending offer to viewers");
        wsConnection.send(JSON.stringify({
          type: 'offer',
          offer: peerConnection.localDescription
        }));
      } else {
        console.error("Cannot send offer: WebSocket not open or no local description");
      }
    })
    .catch(err => {
      console.error("Error creating or sending offer:", err);
    });
}

// Create Peer Connection for the watcher (viewer)
function createWatcherPeerConnection(
  callback?: (stream: MediaStream | null, error?: string) => void
) {
  if (peerConnection) {
    console.log("Closing existing peer connection before creating a new one");
    peerConnection.close();
  }

  // Create new peer connection with ICE servers
  peerConnection = new RTCPeerConnection(iceServers);
  console.log("Camera viewer peer connection created");

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
    if (event.candidate && wsConnection && wsConnection.readyState === 1) { // 1 = OPEN
      console.log("Sending ICE candidate to camera source");
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: 'sharer'
      }));
    } else if (!event.candidate) {
      console.log("ICE candidate gathering completed");
    }
  };

  // Log state changes for debugging
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
    } else if (peerConnection?.iceConnectionState === 'connected') {
      console.log("ICE connection established successfully");
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
    } else if (peerConnection?.connectionState === 'connected') {
      console.log("Connection established successfully");
    }
  };
}

// Handle received offer (for watcher/viewer)
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
        if (wsConnection && wsConnection.readyState === 1 && peerConnection?.localDescription) { // 1 = OPEN
          console.log("Sending answer to camera source");
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

// Handle received answer (for sharer/camera source)
function handleReceivedAnswer(answer: RTCSessionDescriptionInit) {
  if (peerConnection) {
    console.log("Setting remote description (answer)");
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => {
        console.log("Remote description set successfully");
      })
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
    if (wsConnection && wsConnection.readyState === 1) { // 1 = OPEN
      wsConnection.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, 15000); // Send heartbeat every 15 seconds
}
