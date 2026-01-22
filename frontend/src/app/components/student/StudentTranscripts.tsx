import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { FileText, Download, Sparkles, HelpCircle, Send, BookOpen, List } from 'lucide-react';
import { toast } from 'sonner';

const transcripts = [
  { id: '1', title: 'Operating System - Process Scheduling', date: 'Dec 15, 2024' },
  { id: '2', title: 'Artificial Intelligence - Neural Networks', date: 'Dec 14, 2024' },
  { id: '3', title: 'Software Engineering - Agile Methodology', date: 'Dec 13, 2024' },
  { id: '4', title: 'Database Systems - Query Optimization', date: 'Dec 12, 2024' },
];

const sampleNotes = `# Process Scheduling - Key Points

## Main Concepts

### 1. First Come First Served (FCFS)
- Simplest CPU scheduling algorithm
- Non-preemptive in nature
- Poor average waiting time
- Can cause convoy effect

### 2. Shortest Job First (SJF)
- Selects process with smallest execution time
- Can be preemptive or non-preemptive
- Optimal for minimizing average waiting time
- Difficulty in knowing execution time in advance

### 3. Round Robin (RR)
- Each process gets small unit of CPU time (time quantum)
- Preemptive algorithm
- Better response time
- Performance depends on time quantum size

## Key Takeaways
- Scheduling algorithms balance between CPU utilization and response time
- Different algorithms suit different scenarios
- No single best algorithm for all cases`;

const revisionQuestions = [
  'What is the main difference between preemptive and non-preemptive scheduling?',
  'Explain the convoy effect in FCFS scheduling.',
  'How does the time quantum affect Round Robin performance?',
  'What are the advantages and disadvantages of SJF scheduling?',
  'Compare FCFS and Round Robin in terms of response time.',
];

export default function StudentTranscripts() {
  const [selectedTranscript, setSelectedTranscript] = useState('');
  const [view, setView] = useState<'select' | 'notes' | 'questions'>('select');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', message: string}>>([]);

  const handleGenerateNotes = () => {
    if (!selectedTranscript) {
      toast.error('Please select a transcript first');
      return;
    }
    toast.success('Generating notes...');
    setView('notes');
  };

  const handleGenerateQuestions = () => {
    if (!selectedTranscript) {
      toast.error('Please select a transcript first');
      return;
    }
    toast.success('Generating revision questions...');
    setView('questions');
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    if (!selectedTranscript) {
      toast.error('Please select a transcript first');
      return;
    }

    setChatHistory([
      ...chatHistory,
      { role: 'user', message: chatMessage },
      { 
        role: 'assistant', 
        message: 'Based on the lecture transcript, process scheduling is a fundamental OS concept that determines which process runs at any given time. The main algorithms discussed were FCFS, SJF, and Round Robin, each with their own trade-offs.' 
      }
    ]);
    setChatMessage('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">Transcripts & AI Notes</h1>
        <p className="text-muted-foreground">Generate notes, key points, and ask questions about your lectures</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Generation Tools */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Select Lecture</CardTitle>
            <CardDescription>Choose a transcript to work with</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedTranscript} onValueChange={setSelectedTranscript}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lecture..." />
              </SelectTrigger>
              <SelectContent>
                {transcripts.map((transcript) => (
                  <SelectItem key={transcript.id} value={transcript.id}>
                    {transcript.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTranscript && (
              <div className="space-y-2 pt-2">
                <p className="text-sm text-muted-foreground">
                  {transcripts.find(t => t.id === selectedTranscript)?.date}
                </p>
              </div>
            )}

            <div className="space-y-2 pt-4">
              <h4 className="text-sm">Generate Content</h4>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={handleGenerateNotes}
              >
                <BookOpen className="size-4 mr-2" />
                Generate Notes
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => {
                  if (!selectedTranscript) {
                    toast.error('Please select a transcript first');
                    return;
                  }
                  toast.success('Generating key points...');
                }}
              >
                <List className="size-4 mr-2" />
                Generate Key Points
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={handleGenerateQuestions}
              >
                <HelpCircle className="size-4 mr-2" />
                Generate Revision Questions
              </Button>
            </div>

            {view !== 'select' && (
              <div className="pt-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setView('select')}
                >
                  Back to Selection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Content Display */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-600" />
                {view === 'notes' && 'Generated Notes'}
                {view === 'questions' && 'Revision Questions'}
                {view === 'select' && 'AI-Generated Content'}
              </CardTitle>
              {view !== 'select' && (
                <Button variant="outline" size="sm">
                  <Download className="size-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {view === 'select' && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="size-16 mx-auto mb-4 opacity-20" />
                <p>Select a lecture and generate notes or questions to get started</p>
              </div>
            )}

            {view === 'notes' && (
              <ScrollArea className="h-[500px]">
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap">{sampleNotes}</div>
                </div>
              </ScrollArea>
            )}

            {view === 'questions' && (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {revisionQuestions.map((question, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 size-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">
                          {index + 1}
                        </div>
                        <p>{question}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chatbot Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-600" />
            Ask About This Lecture
          </CardTitle>
          <CardDescription>
            Chat is restricted to the selected lecture transcript
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ScrollArea className="h-64 border rounded-lg p-4">
              {chatHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Ask a question about the lecture content
                </div>
              ) : (
                <div className="space-y-4">
                  {chatHistory.map((chat, index) => (
                    <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${
                        chat.role === 'user' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-100'
                      }`}>
                        <p className="text-sm">{chat.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder={selectedTranscript ? "Ask a question about this lecture..." : "Select a transcript first..."}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                disabled={!selectedTranscript}
              />
              <Button onClick={handleSendChat} disabled={!selectedTranscript}>
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
