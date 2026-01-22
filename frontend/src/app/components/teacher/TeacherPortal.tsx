import { useState } from 'react';
import PortalLayout from '../PortalLayout';
import TeacherDashboard from './TeacherDashboard';
import TeacherTimetable from './TeacherTimetable';
import TeacherLiveClass from './TeacherLiveClass';
import TeacherReports from './TeacherReports';
import TeacherRecordings from './TeacherRecordings';
import { LayoutDashboard, Calendar, Video, BarChart3, BookOpen } from 'lucide-react';

interface TeacherPortalProps {
  userName: string;
  onLogout: () => void;
}

type TeacherView = 'dashboard' | 'timetable' | 'liveclass' | 'reports' | 'recordings';

export default function TeacherPortal({ userName, onLogout }: TeacherPortalProps) {
  const [activeView, setActiveView] = useState<TeacherView>('dashboard');

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
      name: 'Live Teaching',
      icon: <Video className="size-5" />,
      active: activeView === 'liveclass',
      onClick: () => setActiveView('liveclass')
    },
    {
      name: 'Session Reports',
      icon: <BarChart3 className="size-5" />,
      active: activeView === 'reports',
      onClick: () => setActiveView('reports')
    },
    {
      name: 'Recordings',
      icon: <BookOpen className="size-5" />,
      active: activeView === 'recordings',
      onClick: () => setActiveView('recordings')
    }
  ];

  return (
    <PortalLayout
      userName={userName}
      userRole="teacher"
      onLogout={onLogout}
      navigation={navigation}
    >
      {activeView === 'dashboard' && <TeacherDashboard onStartClass={() => setActiveView('liveclass')} />}
      {activeView === 'timetable' && <TeacherTimetable />}
      {activeView === 'liveclass' && <TeacherLiveClass />}
      {activeView === 'reports' && <TeacherReports />}
      {activeView === 'recordings' && <TeacherRecordings />}
    </PortalLayout>
  );
}
