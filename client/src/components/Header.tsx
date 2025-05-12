import { useLocation } from "wouter";
import { useState, useEffect } from "react";

export default function Header() {
  const [location] = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected");

  // Update connection status based on WebSocket connection (for a real implementation)
  useEffect(() => {
    // On watch page, we'd update this based on the actual websocket state
    if (location === "/watch") {
      const checkInterval = setInterval(() => {
        // Check for actual websocket connection
        const connection = (window as any).wsConnection; 
        const isWsConnected = Boolean(connection && connection.readyState === 1);
        setConnectionStatus(isWsConnected ? "connected" : "disconnected");
      }, 1000);
      
      return () => clearInterval(checkInterval);
    } else {
      setConnectionStatus("disconnected");
    }
  }, [location]);

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-medium text-primary">SecretCam</h1>
        </div>
        {location === "/watch" && (
          <div className="flex items-center space-x-4">
            <div className="text-sm flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${
                connectionStatus === "connected" ? "bg-green-500" : "bg-gray-300"
              }`}></span>
              <span>{connectionStatus === "connected" ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
