import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/card";
import { 
  Cog, 
  Expand, 
  RefreshCw, 
  TriangleAlert 
} from "lucide-react";
import { connectToWebRTC, disconnectWebRTC } from "@/lib/webrtc";
import SettingsDialog from "@/components/SettingsDialog";

// Stats types
type ConnectionStats = {
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  videoQuality: string;
  dataUsage: string;
  latency: string;
  connectionTime: number; // in seconds
};

export default function Watch() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    connectionStatus: "disconnected",
    videoQuality: "-",
    dataUsage: "0 KB",
    latency: "- ms",
    connectionTime: 0
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Connection status effects
  useEffect(() => {
    // Start connection
    setConnectionStats(prev => ({ ...prev, connectionStatus: "connecting" }));
    
    // Connect to the WebRTC peer
    connectToWebRTC('watcher', (stream, error) => {
      if (error) {
        setConnectionStats(prev => ({ ...prev, connectionStatus: "error" }));
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: error,
        });
        return;
      }
      
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        setConnectionStats(prev => ({ ...prev, connectionStatus: "connected" }));
        
        // Start the connection timer
        startConnectionTimer();
        
        // Fetch video resolution for quality display
        setTimeout(updateVideoQuality, 1000);
      }
    });
    
    // Cleanup function
    return () => {
      disconnectWebRTC();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [toast]);

  const startConnectionTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setConnectionStats(prev => ({
        ...prev,
        connectionTime: prev.connectionTime + 1
      }));
    }, 1000);
  };
  
  const updateVideoQuality = () => {
    if (videoRef.current) {
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      
      let quality = "Unknown";
      if (videoWidth && videoHeight) {
        if (videoWidth >= 1920) {
          quality = `FHD (${videoWidth}x${videoHeight})`;
        } else if (videoWidth >= 1280) {
          quality = `HD (${videoWidth}x${videoHeight})`;
        } else if (videoWidth >= 640) {
          quality = `SD (${videoWidth}x${videoHeight})`;
        } else {
          quality = `LD (${videoWidth}x${videoHeight})`;
        }
        
        setConnectionStats(prev => ({ ...prev, videoQuality: quality }));
      }
    }
  };
  
  const handleRetryConnection = () => {
    // Reset connection state
    setConnectionStats({
      connectionStatus: "connecting",
      videoQuality: "-",
      dataUsage: "0 KB",
      latency: "- ms",
      connectionTime: 0
    });
    
    // Disconnect and reconnect
    disconnectWebRTC();
    
    connectToWebRTC('watcher', (stream, error) => {
      if (error) {
        setConnectionStats(prev => ({ ...prev, connectionStatus: "error" }));
        return;
      }
      
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        setConnectionStats(prev => ({ ...prev, connectionStatus: "connected" }));
        startConnectionTimer();
        setTimeout(updateVideoQuality, 1000);
      }
    });
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        toast({
          variant: "destructive",
          title: "Fullscreen Error",
          description: `Error attempting to enable fullscreen: ${err.message}`
        });
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Format the connection time as HH:MM:SS
  const formattedTime = (() => {
    const seconds = connectionStats.connectionTime;
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  })();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden" ref={containerRef}>
        {/* Connection Status Banner */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span 
                className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStats.connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStats.connectionStatus === 'connecting' ? 'bg-gray-300' : 
                  'bg-red-500'
                }`}
              />
              <span className="text-sm font-medium">
                {connectionStats.connectionStatus === 'connected' ? 'Connected' : 
                 connectionStats.connectionStatus === 'connecting' ? 'Waiting for connection...' : 
                 'Disconnected'}
              </span>
            </div>
            <div>
              {connectionStats.connectionStatus === 'connected' && (
                <span className="text-xs font-medium bg-gray-200 py-1 px-2 rounded-full">
                  {formattedTime}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Video Container */}
        <div className="relative">
          {/* Loading State */}
          {connectionStats.connectionStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-500">Connecting to camera feed...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {connectionStats.connectionStatus === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center px-4">
                <div className="rounded-full h-12 w-12 bg-red-500 flex items-center justify-center mx-auto mb-4">
                  <TriangleAlert className="text-white h-6 w-6" />
                </div>
                <p className="text-lg font-medium mb-1">Connection Failed</p>
                <p className="text-gray-500 text-sm mb-4">
                  Unable to connect to the camera feed. Make sure camera permissions have been granted on the sharing device.
                </p>
                <button 
                  className="bg-primary hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-md transition duration-200"
                  onClick={handleRetryConnection}
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* Video Element */}
          <div className="aspect-w-16 relative bg-black">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              className="w-full h-full object-contain" 
            />
            
            {/* Recording Indicator - shown when connected */}
            {connectionStats.connectionStatus === 'connected' && (
              <div className="absolute top-4 left-4 flex items-center bg-black bg-opacity-50 text-white text-sm py-1 px-3 rounded-full">
                <span className="animate-pulse w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                <span>LIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Video Controls */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <button 
                className="text-gray-600 hover:text-primary p-2 rounded-full hover:bg-gray-200 transition-colors"
                onClick={toggleFullscreen}
                aria-label="Toggle fullscreen"
              >
                <Expand className="h-5 w-5" />
              </button>
            </div>
            <div>
              <button 
                className="text-gray-600 hover:text-primary p-2 rounded-full hover:bg-gray-200 transition-colors mr-2"
                onClick={handleRetryConnection}
                aria-label="Refresh connection"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button 
                className="text-gray-600 hover:text-primary p-2 rounded-full hover:bg-gray-200 transition-colors"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Settings"
              >
                <Cog className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Info Panel */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-medium mb-3">Connection Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Connection Status</p>
            <p className="font-medium">
              {connectionStats.connectionStatus === 'connected' ? 'Connected' : 
               connectionStats.connectionStatus === 'connecting' ? 'Waiting for connection' : 
               'Connection Failed'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Video Quality</p>
            <p className="font-medium">{connectionStats.videoQuality}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Data Usage</p>
            <p className="font-medium">{connectionStats.dataUsage}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Latency</p>
            <p className="font-medium">{connectionStats.latency}</p>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}
