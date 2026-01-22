import { useState } from 'react';
import PortalLayout from '../PortalLayout';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminClasses from './AdminClasses';
import AdminTimetable from './AdminTimetable';
import { LayoutDashboard, Users, BookOpen, Calendar } from 'lucide-react';

interface AdminPortalProps {
  userName: string;
  onLogout: () => void;
}

type AdminView = 'dashboard' | 'users' | 'classes' | 'timetable';

export default function AdminPortal({ userName, onLogout }: AdminPortalProps) {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');

  const navigation = [
    {
      name: 'Dashboard',
      icon: <LayoutDashboard className="size-5" />,
      active: activeView === 'dashboard',
      onClick: () => setActiveView('dashboard')
    },
    {
      name: 'Manage Users',
      icon: <Users className="size-5" />,
      active: activeView === 'users',
      onClick: () => setActiveView('users')
    },
    {
      name: 'Class Allocation',
      icon: <BookOpen className="size-5" />,
      active: activeView === 'classes',
      onClick: () => setActiveView('classes')
    },
    {
      name: 'Timetable Management',
      icon: <Calendar className="size-5" />,
      active: activeView === 'timetable',
      onClick: () => setActiveView('timetable')
    }
  ];

  return (
    <PortalLayout
      userName={userName}
      userRole="admin"
      onLogout={onLogout}
      navigation={navigation}
    >
      {activeView === 'dashboard' && <AdminDashboard />}
      {activeView === 'users' && <AdminUsers />}
      {activeView === 'classes' && <AdminClasses />}
      {activeView === 'timetable' && <AdminTimetable />}
    </PortalLayout>
  );
}
