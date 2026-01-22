import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Plus, Clock, Users, Video } from 'lucide-react';
import { toast } from 'sonner';

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const timetableData = [
  {
    day: 'Monday',
    classes: [
      { time: '09:00 AM', subject: 'Operating System', class: 'CS-3A', students: 45 },
      { time: '02:00 PM', subject: 'Database Systems', class: 'CS-3B', students: 38 },
    ]
  },
  {
    day: 'Tuesday',
    classes: [
      { time: '10:00 AM', subject: 'Computer Networks', class: 'CS-4A', students: 42 },
      { time: '03:00 PM', subject: 'Operating System', class: 'CS-3A', students: 45 },
    ]
  },
  {
    day: 'Wednesday',
    classes: [
      { time: '10:00 AM', subject: 'Operating System', class: 'CS-3A', students: 45 },
      { time: '01:00 PM', subject: 'Database Systems', class: 'CS-3B', students: 38 },
    ]
  },
  {
    day: 'Thursday',
    classes: [
      { time: '11:00 AM', subject: 'Computer Networks', class: 'CS-4A', students: 42 },
      { time: '02:30 PM', subject: 'Database Systems', class: 'CS-3B', students: 38 },
    ]
  },
  {
    day: 'Friday',
    classes: [
      { time: '09:00 AM', subject: 'Operating System', class: 'CS-3A', students: 45 },
      { time: '02:00 PM', subject: 'Computer Networks', class: 'CS-4A', students: 42 },
    ]
  },
];

export default function TeacherTimetable() {
  const [open, setOpen] = useState(false);

  const handleCreateClass = () => {
    toast.success('Class scheduled successfully');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-1">My Timetable</h1>
          <p className="text-muted-foreground">Manage your weekly class schedule</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="size-4" />
              Schedule Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule New Class</DialogTitle>
              <DialogDescription>
                Create a new class session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Class Title</Label>
                <Input id="title" placeholder="e.g., Operating System - Lecture 5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input id="time" type="time" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-group">Class Group</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cs3a">CS-3A</SelectItem>
                    <SelectItem value="cs3b">CS-3B</SelectItem>
                    <SelectItem value="cs4a">CS-4A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" placeholder="Add any notes about this class..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateClass} className="bg-indigo-600 hover:bg-indigo-700">
                Schedule Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{cls.time}</span>
                  </div>
                  
                  <div>
                    <h4 className="text-sm line-clamp-2">{cls.subject}</h4>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{cls.class}</span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {cls.students}
                      </span>
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full text-xs h-7"
                  >
                    <Video className="size-3 mr-1" />
                    Start Session
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
