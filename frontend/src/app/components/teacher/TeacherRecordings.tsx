import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Calendar, Clock, Download, FileText, Play, Search } from 'lucide-react';
import { useState } from 'react';

const recordings = [
  {
    id: 1,
    title: 'Operating System - Process Scheduling',
    class: 'CS-3A',
    date: 'Dec 15, 2024',
    duration: '1:28:45',
    students: 42,
    thumbnail: 'gray-gradient',
  },
  {
    id: 2,
    title: 'Database Systems - Query Optimization',
    class: 'CS-3B',
    date: 'Dec 14, 2024',
    duration: '1:32:10',
    students: 38,
    thumbnail: 'blue-gradient',
  },
  {
    id: 3,
    title: 'Computer Networks - TCP/IP Protocol',
    class: 'CS-4A',
    date: 'Dec 13, 2024',
    duration: '1:25:30',
    students: 42,
    thumbnail: 'purple-gradient',
  },
  {
    id: 4,
    title: 'Operating System - Memory Management',
    class: 'CS-3A',
    date: 'Dec 12, 2024',
    duration: '1:35:20',
    students: 45,
    thumbnail: 'green-gradient',
  },
  {
    id: 5,
    title: 'Database Systems - Transaction Management',
    class: 'CS-3B',
    date: 'Dec 11, 2024',
    duration: '1:30:15',
    students: 38,
    thumbnail: 'indigo-gradient',
  },
  {
    id: 6,
    title: 'Computer Networks - Network Security',
    class: 'CS-4A',
    date: 'Dec 10, 2024',
    duration: '1:40:00',
    students: 42,
    thumbnail: 'orange-gradient',
  },
];

const gradientClasses: Record<string, string> = {
  'gray-gradient': 'from-gray-700 to-gray-900',
  'blue-gradient': 'from-blue-600 to-blue-800',
  'purple-gradient': 'from-purple-600 to-purple-800',
  'green-gradient': 'from-green-600 to-green-800',
  'indigo-gradient': 'from-indigo-600 to-indigo-800',
  'orange-gradient': 'from-orange-600 to-orange-800',
};

export default function TeacherRecordings() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecordings = recordings.filter(rec =>
    rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.class.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">Class Recordings</h1>
        <p className="text-muted-foreground">Manage and share your recorded sessions</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recordings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecordings.map((recording) => (
          <Card key={recording.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className={`aspect-video bg-gradient-to-br ${gradientClasses[recording.thumbnail]} flex items-center justify-center relative group`}>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Play className="size-16 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 text-white text-xs rounded">
                  {recording.duration}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h3 className="line-clamp-2 min-h-[2.5rem]">{recording.title}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{recording.class} • {recording.students} students</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3" />
                    <span className="text-xs">{recording.date}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    <Play className="size-3 mr-1" />
                    Play
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    <FileText className="size-3 mr-1" />
                    Transcript
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    <Download className="size-3 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
