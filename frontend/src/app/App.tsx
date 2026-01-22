// App.tsx
import { useState } from 'react';
import LoginPage from './components/LoginPage';
import StudentPortal from './components/student/StudentPortal';
import TeacherPortal from './components/teacher/TeacherPortal';
import AdminPortal from './components/admin/AdminPortal';
import ConsentModal from './components/ConsentModal';
import { Toaster } from './components/ui/sonner';

export type UserRole = 'student' | 'teacher' | 'admin' | null;

function App() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [userName, setUserName] = useState('');

  const handleLogin = (role: UserRole, name: string) => {
    setUserRole(role);
    setUserName(name);
    // Show consent modal only for students on first login
    if (role === 'student' && !consentGiven) {
      setShowConsent(true);
    }
  };

  const handleConsent = (accepted: boolean) => {
    setConsentGiven(accepted);
    setShowConsent(false);
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserName('');
  };

  if (!userRole) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      {showConsent && (
        <ConsentModal onConsent={handleConsent} />
      )}
      
      {userRole === 'student' && (
        <StudentPortal 
          userName={userName} 
          onLogout={handleLogout}
          emotionTrackingEnabled={consentGiven}
        />
      )}
      
      {userRole === 'teacher' && (
        <TeacherPortal 
          userName={userName} 
          onLogout={handleLogout}
        />
      )}
      
      {userRole === 'admin' && (
        <AdminPortal 
          userName={userName} 
          onLogout={handleLogout}
        />
      )}
      
      <Toaster />
    </>
  );
}

export default App;
