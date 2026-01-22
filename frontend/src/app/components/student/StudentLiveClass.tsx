import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Camera, Mic, Monitor, PhoneOff, Video, VideoOff, MicOff, Eye, EyeOff, Send, FileText, MessageSquare, StickyNote } from 'lucide-react';
import { toast } from 'sonner';

interface StudentLiveClassProps {
  emotionTrackingEnabled: boolean;
}

const chatMessages = [
  { user: 'Prof. Mark Lee', message: 'Welcome everyone! Today we will discuss process scheduling.', time: '10:02 AM', isTeacher: true },
  { user: 'John Doe', message: 'Good morning professor', time: '10:03 AM', isTeacher: false },
  { user: 'Sarah Kim', message: 'Can you share the slides?', time: '10:04 AM', isTeacher: false },
  { user: 'Prof. Mark Lee', message: 'Slides are now available in the Resources tab.', time: '10:05 AM', isTeacher: true },
];

const resources = [
  { name: 'Process Scheduling - Lecture Slides', type: 'PDF', size: '2.4 MB' },
  { name: 'Code Examples - Round Robin', type: 'ZIP', size: '156 KB' },
  { name: 'Reading Material - Chapter 5', type: 'PDF', size: '1.8 MB' },
];

export default function StudentLiveClass({ emotionTrackingEnabled }: StudentLiveClassProps) {
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [emotionTracking, setEmotionTracking] = useState(emotionTrackingEnabled);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');

  const handleToggleEmotionTracking = (enabled: boolean) => {
    setEmotionTracking(enabled);
    toast.success(enabled ? 'Emotion tracking resumed' : 'Emotion tracking paused');
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      toast.success('Message sent');
      setMessage('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-1">Operating System</h1>
          <p className="text-muted-foreground">Live Class with Prof. Mark Lee</p>
        </div>
        <Badge className="bg-red-500 animate-pulse">
          <div className="size-2 rounded-full bg-white mr-2" />
          LIVE
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Video Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-gray-900">
            <CardContent className="p-0 aspect-video relative">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center text-white">
                  <Video className="size-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Teacher's Video Stream</p>
                  <p className="text-sm text-gray-400 mt-1">Prof. Mark Lee is presenting</p>
                </div>
              </div>
              
              {/* Your video preview */}
              <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-700 rounded-lg border-2 border-white overflow-hidden">
                <div className="size-full flex items-center justify-center">
                  {cameraOn ? (
                    <div className="text-white text-xs text-center">
                      <Camera className="size-6 mx-auto mb-1" />
                      <p>You</p>
                    </div>
                  ) : (
                    <VideoOff className="size-6 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Emotion tracking indicator */}
              {emotionTracking && (
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-green-500 rounded-full text-white text-xs flex items-center gap-1">
                  <Eye className="size-3" />
                  Tracking ON
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={cameraOn ? "default" : "destructive"}
                    onClick={() => setCameraOn(!cameraOn)}
                    className={cameraOn ? "bg-gray-600 hover:bg-gray-700" : ""}
                  >
                    {cameraOn ? <Camera className="size-5" /> : <VideoOff className="size-5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant={micOn ? "default" : "destructive"}
                    onClick={() => setMicOn(!micOn)}
                    className={micOn ? "bg-gray-600 hover:bg-gray-700" : ""}
                  >
                    {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                  </Button>
                  <Button size="icon" variant="outline">
                    <Monitor className="size-5" />
                  </Button>
                </div>

                <Button variant="destructive" className="gap-2">
                  <PhoneOff className="size-5" />
                  Leave Class
                </Button>
              </div>

              {/* Emotion Tracking Toggle */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {emotionTracking ? (
                    <Eye className="size-4 text-green-600" />
                  ) : (
                    <EyeOff className="size-4 text-gray-400" />
                  )}
                  <Label htmlFor="emotion-toggle" className="cursor-pointer">
                    Emotion Recognition
                  </Label>
                </div>
                <Switch
                  id="emotion-toggle"
                  checked={emotionTracking}
                  onCheckedChange={handleToggleEmotionTracking}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Tabs */}
        <Card className="lg:col-span-1">
          <CardContent className="p-0">
            <Tabs defaultValue="chat" className="h-[600px] flex flex-col">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="chat" className="flex-1">
                  <MessageSquare className="size-4 mr-2" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="resources" className="flex-1">
                  <FileText className="size-4 mr-2" />
                  Resources
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex-1">
                  <StickyNote className="size-4 mr-2" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-4 space-y-4">
                <ScrollArea className="flex-1">
                  <div className="space-y-4">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm ${msg.isTeacher ? 'text-indigo-600' : ''}`}>
                            {msg.user}
                          </span>
                          <span className="text-xs text-muted-foreground">{msg.time}</span>
                        </div>
                        <p className="text-sm bg-gray-50 p-2 rounded">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button size="icon" onClick={handleSendMessage}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="resources" className="flex-1 m-0 p-4">
                <div className="space-y-3">
                  {resources.map((resource, index) => (
                    <div key={index} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm">{resource.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {resource.type} • {resource.size}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">Download</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="flex-1 m-0 p-4">
                <textarea
                  className="w-full h-full resize-none border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Take notes during the class..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
