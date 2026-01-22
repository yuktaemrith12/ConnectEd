import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calendar, Clock, Plus, Video, Users, TrendingUp, AlertCircle } from 'lucide-react';

interface TeacherDashboardProps {
  onStartClass: () => void;
}

const todayClasses = [
  { time: '10:00 AM', subject: 'Operating System', class: 'CS-3A', students: 45, status: 'live' },
  { time: '02:00 PM', subject: 'Database Systems', class: 'CS-3B', students: 38, status: 'upcoming' },
  { time: '04:00 PM', subject: 'Computer Networks', class: 'CS-4A', students: 42, status: 'upcoming' },
];

const recentReports = [
  { subject: 'Operating System', date: 'Dec 14', avgEngagement: 82, status: 'good' },
  { subject: 'Database Systems', date: 'Dec 13', avgEngagement: 75, status: 'medium' },
  { subject: 'Computer Networks', date: 'Dec 12', avgEngagement: 88, status: 'excellent' },
];

export default function TeacherDashboard({ onStartClass }: TeacherDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-1">Welcome, Prof. Anderson</h1>
          <p className="text-muted-foreground">Here's your teaching overview for today</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Plus className="size-4" />
            Schedule Class
          </Button>
          <Button onClick={onStartClass} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Video className="size-4" />
            Start Session
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Today's Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">3</span>
              <Calendar className="size-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">125</span>
              <Users className="size-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Avg. Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">82%</span>
              <TrendingUp className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Sessions This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">12</span>
              <Video className="size-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your classes for December 18, 2024</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayClasses.map((cls, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-white">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4>{cls.subject}</h4>
                      {cls.status === 'live' && (
                        <Badge className="bg-red-500 animate-pulse">
                          <div className="size-1.5 rounded-full bg-white mr-1" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {cls.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {cls.students} students
                      </span>
                      <span>{cls.class}</span>
                    </div>
                  </div>
                  {cls.status === 'live' ? (
                    <Button onClick={onStartClass} className="bg-indigo-600 hover:bg-indigo-700">
                      Join Session
                    </Button>
                  ) : (
                    <Button variant="outline">View Details</Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Session Reports</CardTitle>
            <CardDescription>Engagement analytics from past classes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentReports.map((report, index) => (
                <div key={index} className="p-4 rounded-lg border bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm">{report.subject}</h4>
                      <p className="text-xs text-muted-foreground">{report.date}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl">{report.avgEngagement}%</div>
                      <Badge 
                        variant={report.status === 'excellent' ? 'default' : 'secondary'}
                        className={
                          report.status === 'excellent' ? 'bg-green-500' :
                          report.status === 'good' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }
                      >
                        {report.status}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="link" className="h-auto p-0 text-xs">
                    View Full Report →
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Alert */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="size-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h4 className="mb-1">Teaching Insight</h4>
              <p className="text-sm text-muted-foreground">
                Students showed lower engagement during the last 15 minutes of your Database Systems class on Dec 13. 
                Consider adding interactive elements or taking a short break during longer sessions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
