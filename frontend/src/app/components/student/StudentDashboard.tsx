import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calendar, Clock, Video, TrendingUp, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentDashboardProps {
  onJoinClass: () => void;
}

const engagementData = [
  { time: '10min', engagement: 85 },
  { time: '20min', engagement: 78 },
  { time: '30min', engagement: 82 },
  { time: '40min', engagement: 75 },
  { time: '50min', engagement: 88 },
];

const upcomingClasses = [
  { subject: 'Operating System', teacher: 'Mark Lee', time: '10:00 AM', day: 'Today' },
  { subject: 'Artificial Intelligence', teacher: 'Jung Jaehyun', time: '2:00 PM', day: 'Today' },
  { subject: 'Software Engineering', teacher: 'Kim Taeyeong', time: '11:00 AM', day: 'Tomorrow' },
];

export default function StudentDashboard({ onJoinClass }: StudentDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">Welcome back, Christine!</h1>
        <p className="text-muted-foreground">Here's your learning overview for today</p>
      </div>

      {/* Next Class Card */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Operating System</CardTitle>
              <CardDescription className="text-base">with Mark Lee</CardDescription>
            </div>
            <Badge className="bg-green-500">LIVE</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" />
                <span>10:00 AM - 11:30 AM</span>
              </div>
            </div>
            <Button onClick={onJoinClass} className="bg-indigo-600 hover:bg-indigo-700">
              <Video className="size-4 mr-2" />
              Join Class
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly Schedule Preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Your schedule for the next 2 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingClasses.map((cls, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4>{cls.subject}</h4>
                      {index === 0 && <Badge variant="outline" className="text-xs">Next</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">Instructor: {cls.teacher}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{cls.time}</p>
                    <p className="text-xs text-muted-foreground">{cls.day}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">92%</span>
                  <CheckCircle2 className="size-8 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">23 of 25 classes attended</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Avg. Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">81%</span>
                  <TrendingUp className="size-8 text-indigo-500" />
                </div>
                <p className="text-sm text-muted-foreground">Last session: 85%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Engagement Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Your Last Session Engagement</CardTitle>
          <CardDescription>Emotion analytics from Operating System - Dec 15</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={engagementData}>
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
  );
}
