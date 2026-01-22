import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Video, Clock, User } from 'lucide-react';

interface StudentTimetableProps {
  onJoinClass: () => void;
}

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const timetableData = [
  {
    day: 'Monday',
    classes: [
      { time: '09:00 AM', subject: 'Operating System', teacher: 'Mark Lee', status: 'completed' },
      { time: '02:00 PM', subject: 'Database Systems', teacher: 'Sarah Kim', status: 'completed' },
    ]
  },
  {
    day: 'Tuesday',
    classes: [
      { time: '10:00 AM', subject: 'Artificial Intelligence', teacher: 'Jung Jaehyun', status: 'completed' },
      { time: '03:00 PM', subject: 'Web Development', teacher: 'Lisa Park', status: 'completed' },
    ]
  },
  {
    day: 'Wednesday',
    classes: [
      { time: '10:00 AM', subject: 'Operating System', teacher: 'Mark Lee', status: 'live' },
      { time: '01:00 PM', subject: 'Software Engineering', teacher: 'Kim Taeyeong', status: 'upcoming' },
    ]
  },
  {
    day: 'Thursday',
    classes: [
      { time: '11:00 AM', subject: 'Artificial Intelligence', teacher: 'Jung Jaehyun', status: 'upcoming' },
      { time: '02:30 PM', subject: 'Database Systems', teacher: 'Sarah Kim', status: 'upcoming' },
    ]
  },
  {
    day: 'Friday',
    classes: [
      { time: '09:00 AM', subject: 'Software Engineering', teacher: 'Kim Taeyeong', status: 'upcoming' },
      { time: '02:00 PM', subject: 'Web Development', teacher: 'Lisa Park', status: 'upcoming' },
    ]
  },
];

export default function StudentTimetable({ onJoinClass }: StudentTimetableProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">My Timetable</h1>
        <p className="text-muted-foreground">Your weekly class schedule</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {timetableData.map((dayData, index) => (
          <Card key={index} className={dayData.day === 'Wednesday' ? 'border-indigo-300' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{dayData.day}</CardTitle>
              <CardDescription className="text-xs">
                {dayData.classes.length} classes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dayData.classes.map((cls, clsIndex) => (
                <div key={clsIndex} className="p-3 rounded-lg border bg-white space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{cls.time}</span>
                    </div>
                    {cls.status === 'live' && (
                      <Badge className="bg-green-500 text-xs px-1.5 py-0">LIVE</Badge>
                    )}
                    {cls.status === 'completed' && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">Done</Badge>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-sm line-clamp-2">{cls.subject}</h4>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <User className="size-3" />
                      <span className="truncate">{cls.teacher}</span>
                    </div>
                  </div>

                  {cls.status === 'live' && (
                    <Button 
                      size="sm" 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-xs h-7"
                      onClick={onJoinClass}
                    >
                      <Video className="size-3 mr-1" />
                      Join Now
                    </Button>
                  )}
                  {cls.status === 'upcoming' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full text-xs h-7"
                      disabled
                    >
                      Upcoming
                    </Button>
                  )}
                  {cls.status === 'completed' && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-full text-xs h-7"
                    >
                      View Recording
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
