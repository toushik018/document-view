import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Video, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeWebRTC, disconnectWebRTC } from "@/lib/webrtc";

type PermissionState = "initial" | "pending" | "granted" | "denied";

export default function Home() {
  const [permissionState, setPermissionState] =
    useState<PermissionState>("initial");
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      disconnectWebRTC();
    };
  }, []);

  const requestCameraPermission = async () => {
    try {
      setPermissionState("pending");

      // Request both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true, // Enable audio for this application
      });

      // Store stream reference for later cleanup
      localStreamRef.current = stream;

      // Connect the stream to the hidden video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize WebRTC with the stream
      initializeWebRTC(stream, "sharer");

      setPermissionState("granted");

      toast({
        title: "Camera and microphone access granted",
        description:
          "Your camera and microphone are now streaming in the background",
      });
    } catch (error) {
      console.error("Error accessing camera or microphone:", error);
      setPermissionState("denied");

      toast({
        variant: "destructive",
        title: "Camera access denied",
        description:
          "Please allow camera and microphone access to use this application",
      });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <Card className="bg-white rounded-lg shadow-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-medium mb-2">Camera Access</h2>
            <p className="text-gray-500">
              This site needs access to your camera and microphone to function
              correctly.
            </p>
          </div>

          {/* Initial State - Before Permission */}
          {permissionState === "initial" && (
            <div className="text-center mb-6">
              <Button
                className="bg-primary hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-md transition duration-200 flex items-center justify-center mx-auto"
                onClick={requestCameraPermission}
              >
                <Video className="mr-2 h-4 w-4" />
                Allow Camera & Mic Access
              </Button>
              <p className="text-sm text-gray-500 mt-3">
                Your privacy is important to us. Camera and microphone access is
                only used for this session.
              </p>
            </div>
          )}

          {/* Pending Permission State */}
          {permissionState === "pending" && (
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
              <p>Waiting for camera access permission...</p>
            </div>
          )}

          {/* Permission Granted State */}
          {permissionState === "granted" && (
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="rounded-full h-12 w-12 bg-green-500 flex items-center justify-center">
                  <Check className="text-white text-xl" />
                </div>
              </div>
              <p className="text-lg font-medium mb-1">Access Granted</p>
              <p className="text-gray-500 text-sm">
                Your camera and microphone are now streaming. You can minimize
                this tab and it will continue to work.
              </p>

              <div className="mt-6 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <AlertCircle className="text-primary h-5 w-5" />
                  </div>
                  <div className="ml-3 text-left">
                    <p className="text-sm text-gray-700">
                      Your camera and mic will continue to stream in the
                      background even when minimized.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Permission Denied State */}
          {permissionState === "denied" && (
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="rounded-full h-12 w-12 bg-red-500 flex items-center justify-center">
                  <X className="text-white text-xl" />
                </div>
              </div>
              <p className="text-lg font-medium mb-1">Access Denied</p>
              <p className="text-gray-500 text-sm mb-4">
                This application requires camera and microphone access to
                function correctly.
              </p>
              <Button
                className="bg-primary hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-md transition duration-200"
                onClick={requestCameraPermission}
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden video element for streaming - 
           This stays hidden but keeps the stream active
           when the user minimizes the browser */}
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
    </div>
  );
}
