import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Clock, Download, TrendingDown, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const sessions = [
  {
    id: 1,
    subject: 'Operating System',
    class: 'CS-3A',
    date: 'Dec 15, 2024',
    duration: '1:28:45',
    avgEngagement: 82,
    status: 'good'
  },
  {
    id: 2,
    subject: 'Database Systems',
    class: 'CS-3B',
    date: 'Dec 14, 2024',
    duration: '1:32:10',
    avgEngagement: 75,
    status: 'medium'
  },
  {
    id: 3,
    subject: 'Computer Networks',
    class: 'CS-4A',
    date: 'Dec 13, 2024',
    duration: '1:25:30',
    avgEngagement: 88,
    status: 'excellent'
  },
];

const detailedEngagement = [
  { time: '0:00', engagement: 85 },
  { time: '0:10', engagement: 82 },
  { time: '0:20', engagement: 78 },
  { time: '0:30', engagement: 75 },
  { time: '0:40', engagement: 68 },
  { time: '0:50', engagement: 70 },
  { time: '1:00', engagement: 82 },
  { time: '1:10', engagement: 85 },
  { time: '1:20', engagement: 88 },
];

const emotionBreakdown = [
  { emotion: 'Engaged', count: 65 },
  { emotion: 'Neutral', count: 25 },
  { emotion: 'Confused', count: 10 },
];

const confusingMoments = [
  { timestamp: '0:38:20', topic: 'Priority Inversion explanation', engagement: 42 },
  { timestamp: '0:52:15', topic: 'Deadlock prevention algorithms', engagement: 48 },
];

export default function TeacherReports() {
  const [selectedSession, setSelectedSession] = useState<typeof sessions[0] | null>(null);

  if (selectedSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl mb-1">Session Report: {selectedSession.subject}</h1>
            <p className="text-muted-foreground">{selectedSession.class} • {selectedSession.date}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedSession(null)}>
              Back to Reports
            </Button>
            <Button className="gap-2">
              <Download className="size-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl text-indigo-600 mb-1">{selectedSession.avgEngagement}%</div>
                <p className="text-sm text-muted-foreground">Avg. Engagement</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl text-green-600 mb-1">65%</div>
                <p className="text-sm text-muted-foreground">Highly Engaged</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl text-yellow-600 mb-1">25%</div>
                <p className="text-sm text-muted-foreground">Neutral</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl text-red-600 mb-1">10%</div>
                <p className="text-sm text-muted-foreground">Confused</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Engagement Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Engagement Over Time</CardTitle>
              <CardDescription>Class engagement throughout the session</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={detailedEngagement}>
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

          {/* Emotion Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Emotion Distribution</CardTitle>
              <CardDescription>Overall class mood breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={emotionBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="emotion" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confusing Moments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-yellow-600" />
                Moments with Low Engagement
              </CardTitle>
              <CardDescription>Topics that may need clarification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {confusingMoments.map((moment, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-xs">{moment.timestamp}</Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                        {moment.engagement}% engaged
                      </Badge>
                    </div>
                    <p className="text-sm">{moment.topic}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-indigo-600" />
              AI-Generated Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm mb-1">Strong Start</h4>
                  <p className="text-sm text-muted-foreground">
                    The first 30 minutes showed excellent engagement. Students were highly attentive during the introduction.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingDown className="size-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm mb-1">Mid-Session Dip</h4>
                  <p className="text-sm text-muted-foreground">
                    Engagement dropped around 40 minutes. Consider adding an interactive element or short break at this point in future sessions.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm mb-1">Complex Topics</h4>
                  <p className="text-sm text-muted-foreground">
                    Students showed confusion during the Priority Inversion and Deadlock prevention sections. Consider revisiting these topics with more examples.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm mb-1">Strong Finish</h4>
                  <p className="text-sm text-muted-foreground">
                    The final 20 minutes showed recovered engagement, suggesting the Q&A and practical examples were effective.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transcript with Highlights */}
        <Card>
          <CardHeader>
            <CardTitle>Session Transcript</CardTitle>
            <CardDescription>Highlighted moments of low engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <Badge variant="outline" className="text-xs">00:02:15</Badge>
                  <p className="text-muted-foreground">
                    Today we're going to discuss process scheduling algorithms. This is a fundamental concept in operating systems.
                  </p>
                </div>
                <div className="space-y-1 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Badge variant="outline" className="text-xs bg-yellow-100">00:38:20 - Low Engagement</Badge>
                  <p className="text-muted-foreground">
                    Now let's discuss priority inversion. This occurs when a high priority task is waiting for a low priority task...
                  </p>
                </div>
                <div className="space-y-1">
                  <Badge variant="outline" className="text-xs">00:45:10</Badge>
                  <p className="text-muted-foreground">
                    Moving on to Round Robin scheduling. This is one of the most commonly used algorithms...
                  </p>
                </div>
                <div className="space-y-1 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Badge variant="outline" className="text-xs bg-yellow-100">00:52:15 - Low Engagement</Badge>
                  <p className="text-muted-foreground">
                    Deadlock prevention algorithms are crucial. We have four conditions that must be satisfied...
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">Session Reports</h1>
        <p className="text-muted-foreground">View engagement analytics and insights from your classes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <CardTitle className="text-lg">{session.subject}</CardTitle>
                  <CardDescription>{session.class}</CardDescription>
                </div>
                <Badge 
                  className={
                    session.status === 'excellent' ? 'bg-green-500' :
                    session.status === 'good' ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }
                >
                  {session.avgEngagement}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4" />
                  <span>{session.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  <span>{session.duration}</span>
                </div>
              </div>
              <Button 
                className="w-full"
                onClick={() => setSelectedSession(session)}
              >
                View Full Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
