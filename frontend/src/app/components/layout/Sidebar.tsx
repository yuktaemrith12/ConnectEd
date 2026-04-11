// Navigation sidebar used across all role dashboards.
// The navigationConfig object defines which menu items appear for each role.
// The sidebar can be collapsed to icon-only mode via the toggle button.

import { motion } from "motion/react";
import { Link, useLocation, useParams } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  DollarSign,
  ClipboardList,
  GraduationCap,
  FileText,
  BarChart3,
  Brain,
  Video,
  Clock,
  MessageSquare,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  FileCheck,
  MapPin,
  RadioTower,
  Shield,
} from "lucide-react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  section?: string;
}

// Logo is now in /public/images/ folder
const logo = "/images/logo.png";

interface SidebarProps {
  role: "student" | "teacher" | "parent" | "admin";
  collapsed: boolean;
  onToggle: () => void;
}

const navigationConfig: Record<string, NavItem[]> = {
  admin: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin", section: "CORE OPERATIONS" },
    { icon: Users, label: "User Management", path: "/admin/users" },
    { icon: BookOpen, label: "Classes & Subjects", path: "/admin/classes" },
    { icon: Clock, label: "Timetable Builder", path: "/admin/timetable" },
    { icon: ClipboardList, label: "Attendance Overview", path: "/admin/attendance", section: "SCHOOL OPERATIONS" },
    { icon: MapPin, label: "Locations", path: "/admin/locations" },
    { icon: Calendar, label: "Events & Exams", path: "/admin/events" },
    { icon: DollarSign, label: "Fees & Payments", path: "/admin/fees" },
    { icon: Shield, label: "Consent Compliance", path: "/admin/consent", section: "COMPLIANCE" },
  ],
  teacher: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/teacher", section: "Core Teaching Workflow" },
    { icon: Clock, label: "Timetable", path: "/teacher/timetable" },
    { icon: ClipboardList, label: "Attendance", path: "/teacher/attendance" },
    { icon: FileText, label: "Homework", path: "/teacher/homework", section: "Assessment & Coursework" },
    { icon: GraduationCap, label: "Assignments", path: "/teacher/assignments" },
    { icon: BarChart3, label: "Grading", path: "/teacher/grading" },
    { icon: Brain, label: "AI Tutor", path: "/teacher/ai-tutor", section: "AI & Insights" },
    { icon: RadioTower, label: "Live Class", path: "/teacher/video-conference", section: "Teaching Review & Improvement" },
    { icon: Video, label: "Recordings", path: "/teacher/recordings" },
    { icon: MessageSquare, label: "Messages", path: "/teacher/messages", section: "Communication" },
  ],
  student: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/student" },
    { icon: Clock, label: "Timetable", path: "/student/timetable" },
    { icon: FileText, label: "Homework", path: "/student/homework" },
    { icon: FileCheck, label: "Assignments", path: "/student/assignments" },
    { icon: ClipboardList, label: "Attendance", path: "/student/attendance" },
    { icon: BarChart3, label: "Grades", path: "/student/grades" },
    { icon: Video, label: "Class Recordings", path: "/student/class-recordings" },
    { icon: Sparkles, label: "Transcript to Notes", path: "/student/transcript-to-notes" },
    { icon: Brain, label: "AI Tutor", path: "/student/ai-tutor" },
    { icon: MessageSquare, label: "Messages", path: "/student/messages" },
    { icon: MessageCircle, label: "WhatsApp Alerts", path: "/student/whatsapp" },
    { icon: Shield, label: "Privacy & Consent", path: "/student/consent" },
  ],
  parent: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/parent" },
    { icon: ClipboardList, label: "Attendance", path: "/parent/attendance" },
    { icon: BarChart3, label: "Grades", path: "/parent/grades" },
    { icon: GraduationCap, label: "Assignments", path: "/parent/assignments" },
    { icon: DollarSign, label: "Fees", path: "/parent/fees" },
    { icon: Calendar, label: "Events & Exams", path: "/parent/events" },
    { icon: MessageSquare, label: "Messages", path: "/parent/messages" },
    { icon: MessageCircle, label: "WhatsApp Alerts", path: "/parent/whatsapp" },
    { icon: Shield, label: "Child Data Consent", path: "/parent/consent" },
  ],
};

const roleColors = {
  student: "from-[#3b82f6] to-[#60a5fa]",
  teacher: "from-[#8b5cf6] to-[#a78bfa]",
  parent: "from-[#10b981] to-[#34d399]",
  admin: "from-[#f97316] to-[#fb923c]",
};

export default function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const params = useParams();
  const navItems = navigationConfig[role];

  // Get childId for parent role
  const childId = role === "parent" ? params.childId || "1" : null;

  // Build navigation paths with childId for parent role
  const getNavPath = (basePath: string) => {
    if (role === "parent" && childId) {
      // Replace /parent with /parent/:childId
      return basePath.replace("/parent", `/parent/${childId}`);
    }
    return basePath;
  };

  return (
    <motion.aside
      animate={{
        width: collapsed ? "80px" : "280px",
      }}
      className="fixed left-0 top-0 h-screen bg-white border-r border-gray-200 shadow-sm z-50 flex flex-col"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-gray-200">
        <motion.div 
          animate={{ scale: collapsed ? 1.2 : 1 }}
          className="flex items-center gap-3"
        >
          <img 
            src={logo} 
            alt="ConnectEd Logo"
            className="w-10 h-10 flex-shrink-0 object-contain"
          />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-xl"
            >
              ConnectEd
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const navPath = getNavPath(item.path);
            const isActive = location.pathname === navPath;
            const showSection = !collapsed && item.section && (index === 0 || navItems[index - 1].section !== item.section);
            
            return (
              <div key={item.path}>
                {showSection && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-4 py-2 mt-4 mb-2"
                  >
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {item.section}
                    </p>
                  </motion.div>
                )}
                <Link to={navPath}>
                  <div
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:translate-x-1 ${
                      isActive
                        ? `bg-gradient-to-r ${roleColors[role]} text-white shadow-lg`
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm font-medium"
                      >
                        {item.label}
                      </motion.span>
                    )}
                    {isActive && !collapsed && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"
                      />
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="border-t border-gray-200 p-4 space-y-1">
        <Link to="/">
          <button
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 w-full transition-all hover:translate-x-1"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </Link>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`absolute -right-3 top-24 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors`}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}