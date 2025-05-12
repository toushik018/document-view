import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [videoQuality, setVideoQuality] = useState("auto");
  const [connectionPriority, setConnectionPriority] = useState("quality");
  const [showStats, setShowStats] = useState(false);

  const handleSave = () => {
    // In a real app, this would save the settings and apply them
    // For this example, we'll just close the dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="quality-setting">Video Quality</Label>
            <Select value={videoQuality} onValueChange={setVideoQuality}>
              <SelectTrigger id="quality-setting">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Recommended)</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="connection-priority">Connection Priority</Label>
            <Select value={connectionPriority} onValueChange={setConnectionPriority}>
              <SelectTrigger id="connection-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">Video Quality</SelectItem>
                <SelectItem value="speed">Connection Speed</SelectItem>
                <SelectItem value="reliability">Reliability</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show-stats" 
              checked={showStats} 
              onCheckedChange={(checked) => setShowStats(checked as boolean)} 
            />
            <Label htmlFor="show-stats" className="text-sm">Show connection statistics</Label>
          </div>
        </div>
        <DialogFooter className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
          <Button type="submit" onClick={handleSave}>Save Changes</Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="mt-3 sm:mt-0 sm:mr-3"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
