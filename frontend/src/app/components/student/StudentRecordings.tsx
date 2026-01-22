import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Play, FileText, Clock, Calendar, Search, Download } from 'lucide-react';

const recordings = [
  {
    id: 1,
    title: 'Operating System - Process Scheduling',
    teacher: 'Prof. Mark Lee',
    date: 'Dec 15, 2024',
    duration: '1:28:45',
    thumbnail: 'gray-gradient',
  },
  {
    id: 2,
    title: 'Artificial Intelligence - Neural Networks',
    teacher: 'Prof. Jung Jaehyun',
    date: 'Dec 14, 2024',
    duration: '1:32:10',
    thumbnail: 'blue-gradient',
  },
  {
    id: 3,
    title: 'Software Engineering - Agile Methodology',
    teacher: 'Prof. Kim Taeyeong',
    date: 'Dec 13, 2024',
    duration: '1:25:30',
    thumbnail: 'purple-gradient',
  },
  {
    id: 4,
    title: 'Database Systems - Query Optimization',
    teacher: 'Prof. Sarah Kim',
    date: 'Dec 12, 2024',
    duration: '1:35:20',
    thumbnail: 'green-gradient',
  },
  {
    id: 5,
    title: 'Operating System - Memory Management',
    teacher: 'Prof. Mark Lee',
    date: 'Dec 11, 2024',
    duration: '1:30:15',
    thumbnail: 'gray-gradient',
  },
  {
    id: 6,
    title: 'Web Development - React Advanced Patterns',
    teacher: 'Prof. Lisa Park',
    date: 'Dec 10, 2024',
    duration: '1:40:00',
    thumbnail: 'indigo-gradient',
  },
];

export default function StudentRecordings() {
  const [selectedRecording, setSelectedRecording] = useState<typeof recordings[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecordings = recordings.filter(rec =>
    rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.teacher.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gradientClasses: Record<string, string> = {
    'gray-gradient': 'from-gray-700 to-gray-900',
    'blue-gradient': 'from-blue-600 to-blue-800',
    'purple-gradient': 'from-purple-600 to-purple-800',
    'green-gradient': 'from-green-600 to-green-800',
    'indigo-gradient': 'from-indigo-600 to-indigo-800',
  };

  if (selectedRecording) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl mb-1">{selectedRecording.title}</h1>
            <p className="text-muted-foreground">{selectedRecording.teacher} • {selectedRecording.date}</p>
          </div>
          <Button variant="outline" onClick={() => setSelectedRecording(null)}>
            Back to Recordings
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <div className={`aspect-video bg-gradient-to-br ${gradientClasses[selectedRecording.thumbnail]} flex items-center justify-center`}>
                <div className="text-center text-white">
                  <Play className="size-20 mx-auto mb-4" />
                  <p className="text-xl">Video Player</p>
                  <p className="text-sm mt-2 opacity-75">Duration: {selectedRecording.duration}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-900 text-white flex items-center gap-4">
                <Button variant="secondary" size="icon">
                  <Play className="size-5" />
                </Button>
                <div className="flex-1">
                  <div className="h-1 bg-gray-700 rounded-full">
                    <div className="h-full w-1/3 bg-indigo-500 rounded-full" />
                  </div>
                </div>
                <span className="text-sm">0:28:30 / {selectedRecording.duration}</span>
              </div>
            </CardContent>
          </Card>

          {/* Transcript Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="size-5" />
                Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4 text-sm">
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">00:02:15</Badge>
                    <p className="text-muted-foreground">
                      Today we're going to discuss process scheduling algorithms. This is a fundamental concept in operating systems.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">00:03:45</Badge>
                    <p className="text-muted-foreground">
                      Let's start with First Come First Served, or FCFS. It's the simplest scheduling algorithm.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">00:05:20</Badge>
                    <p className="text-muted-foreground">
                      The main advantage is its simplicity, but it can lead to poor average waiting time.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">00:07:10</Badge>
                    <p className="text-muted-foreground">
                      Now let's move on to Shortest Job First. This algorithm selects the process with the smallest execution time.
                    </p>
                  </div>
                </div>
              </ScrollArea>
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" className="w-full">
                  <Download className="size-4 mr-2" />
                  Download Full Transcript
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">Class Recordings</h1>
        <p className="text-muted-foreground">Watch and review your past classes</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Search recordings by title or teacher..."
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
              <div className={`aspect-video bg-gradient-to-br ${gradientClasses[recording.thumbnail]} flex items-center justify-center relative group cursor-pointer`}
                onClick={() => setSelectedRecording(recording)}
              >
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="size-16 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 text-white text-xs rounded">
                  {recording.duration}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h3 className="line-clamp-2 min-h-[2.5rem]">{recording.title}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{recording.teacher}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span className="text-xs">{recording.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      <span className="text-xs">{recording.duration}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => setSelectedRecording(recording)}
                  >
                    <Play className="size-4 mr-2" />
                    Watch
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <FileText className="size-4 mr-2" />
                    Transcript
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
