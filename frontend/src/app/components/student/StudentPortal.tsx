import { useState } from 'react';
import PortalLayout from '../PortalLayout';
import StudentDashboard from './StudentDashboard';
import StudentTimetable from './StudentTimetable';
import StudentLiveClass from './StudentLiveClass';
import StudentRecordings from './StudentRecordings';
import StudentTranscripts from './StudentTranscripts';
import { LayoutDashboard, Calendar, Video, FileText, BookOpen } from 'lucide-react';

interface StudentPortalProps {
  userName: string;
  onLogout: () => void;
  emotionTrackingEnabled: boolean;
}

type StudentView = 'dashboard' | 'timetable' | 'liveclass' | 'recordings' | 'transcripts';

export default function StudentPortal({ userName, onLogout, emotionTrackingEnabled }: StudentPortalProps) {
  const [activeView, setActiveView] = useState<StudentView>('dashboard');

  const navigation = [
    {
      name: 'Dashboard',
      icon: <LayoutDashboard className="size-5" />,
      active: activeView === 'dashboard',
      onClick: () => setActiveView('dashboard')
    },
    {
      name: 'Timetable',
      icon: <Calendar className="size-5" />,
      active: activeView === 'timetable',
      onClick: () => setActiveView('timetable')
    },
    {
      name: 'Live Class',
      icon: <Video className="size-5" />,
      active: activeView === 'liveclass',
      onClick: () => setActiveView('liveclass')
    },
    {
      name: 'Recordings',
      icon: <BookOpen className="size-5" />,
      active: activeView === 'recordings',
      onClick: () => setActiveView('recordings')
    },
    {
      name: 'Transcripts & Notes',
      icon: <FileText className="size-5" />,
      active: activeView === 'transcripts',
      onClick: () => setActiveView('transcripts')
    }
  ];

  return (
    <PortalLayout
      userName={userName}
      userRole="student"
      onLogout={onLogout}
      navigation={navigation}
    >
      {activeView === 'dashboard' && <StudentDashboard onJoinClass={() => setActiveView('liveclass')} />}
      {activeView === 'timetable' && <StudentTimetable onJoinClass={() => setActiveView('liveclass')} />}
      {activeView === 'liveclass' && <StudentLiveClass emotionTrackingEnabled={emotionTrackingEnabled} />}
      {activeView === 'recordings' && <StudentRecordings />}
      {activeView === 'transcripts' && <StudentTranscripts />}
    </PortalLayout>
  );
}
