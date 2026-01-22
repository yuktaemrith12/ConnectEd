import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Camera, Shield, Info } from 'lucide-react';

interface ConsentModalProps {
  onConsent: (accepted: boolean) => void;
}

export default function ConsentModal({ onConsent }: ConsentModalProps) {
  const [allowTracking, setAllowTracking] = useState(true);

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Camera className="size-6" />
          </div>
          <DialogTitle>Emotion Recognition Consent</DialogTitle>
          <DialogDescription className="text-base space-y-3 pt-2">
            <div className="flex items-start gap-2">
              <Info className="size-5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <p>
                ConnectEd uses facial emotion recognition during live classes to estimate your engagement and help improve the learning experience.
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <Shield className="size-5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                Your privacy is important. All emotion data is processed in real-time and aggregated. You can pause tracking anytime during a session.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
          <Label htmlFor="tracking-toggle" className="cursor-pointer">
            Allow emotion tracking during live classes
          </Label>
          <Switch
            id="tracking-toggle"
            checked={allowTracking}
            onCheckedChange={setAllowTracking}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onConsent(false)}
          >
            Decline
          </Button>
          <Button
            onClick={() => onConsent(allowTracking)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
