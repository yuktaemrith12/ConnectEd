import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Camera, Mic, Monitor, PhoneOff, Video, VideoOff, MicOff, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const moodData = [
  { name: 'Engaged', value: 24, color: '#10b981' },
  { name: 'Neutral', value: 12, color: '#f59e0b' },
  { name: 'Confused', value: 6, color: '#ef4444' },
];

const engagementTimeline = [
  { time: '10:00', engagement: 85 },
  { time: '10:05', engagement: 82 },
  { time: '10:10', engagement: 78 },
  { time: '10:15', engagement: 75 },
  { time: '10:20', engagement: 80 },
  { time: '10:25', engagement: 88 },
];

export default function TeacherLiveClass() {
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-1">Operating System - CS-3A</h1>
          <p className="text-muted-foreground">Live Teaching Session</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-red-500 animate-pulse px-3 py-1.5">
            <div className="size-2 rounded-full bg-white mr-2" />
            RECORDING
          </Badge>
          <Badge className="bg-green-500 px-3 py-1.5">
            <Users className="size-4 mr-1" />
            42 Students
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Video Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-gray-900">
            <CardContent className="p-0 aspect-video relative">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center text-white">
                  <Video className="size-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Your Video Stream</p>
                  <p className="text-sm text-gray-400 mt-1">Students can see your presentation</p>
                </div>
              </div>
              
              {recording && (
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500 rounded-full text-white text-sm flex items-center gap-2 animate-pulse">
                  <div className="size-2 rounded-full bg-white" />
                  REC 00:25:34
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
                  End Session
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Real-Time Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={engagementTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Live Analytics */}
        <div className="space-y-4">
          {/* Live Mood Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Class Mood</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={moodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {moodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {moodData.map((mood, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full" style={{ backgroundColor: mood.color }} />
                      <span>{mood.name}</span>
                    </div>
                    <span>{mood.value} students</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Counters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span>Engaged Students</span>
                  <span className="text-green-600">57%</span>
                </div>
                <Progress value={57} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span>Neutral</span>
                  <span className="text-yellow-600">29%</span>
                </div>
                <Progress value={29} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span>Confused</span>
                  <span className="text-red-600">14%</span>
                </div>
                <Progress value={14} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span>25:34</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Students</span>
                <span>42 / 45</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg. Engagement</span>
                <span className="text-indigo-600">80%</span>
              </div>
            </CardContent>
          </Card>

          {/* Alert */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Note:</strong> Emotion data is class-aggregated. Individual student identities are not tracked.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
