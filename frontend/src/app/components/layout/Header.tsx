// Top header bar used across all role dashboards.
// Provides a role-aware search bar, the parent child-selector dropdown,
// and the profile menu (settings link + logout).

import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, User, Users, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/app/components/ui/input";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { useParams, useNavigate, useLocation, Link } from "react-router";
import { getStoredFullName, parentGetChildren, ParentChild } from "@/app/utils/api";

interface HeaderProps {
  role: "student" | "teacher" | "parent" | "admin";
}

const roleLabels = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
  admin: "Admin",
};

interface SearchItem {
  label: string;
  path: string;
  description?: string;
  keywords?: string[];
}

const searchConfig: Record<string, SearchItem[]> = {
  admin: [
    { label: "Dashboard", path: "/admin", description: "Overview & stats" },
    { label: "User Management", path: "/admin/users", description: "Manage students & teachers", keywords: ["users", "students", "teachers", "accounts"] },
    { label: "Classes & Subjects", path: "/admin/classes", description: "Configure classes and subjects", keywords: ["classes", "subjects", "curriculum"] },
    { label: "Timetable Builder", path: "/admin/timetable", description: "Build class schedules", keywords: ["timetable", "schedule", "periods"] },
    { label: "Attendance Overview", path: "/admin/attendance", description: "School-wide attendance", keywords: ["attendance", "absent", "present"] },
    { label: "Locations", path: "/admin/locations", description: "Manage rooms & venues", keywords: ["locations", "rooms", "venues"] },
    { label: "Events & Exams", path: "/admin/events", description: "School events and exams", keywords: ["events", "exams", "calendar"] },
    { label: "Fees & Payments", path: "/admin/fees", description: "Fee collection overview", keywords: ["fees", "payments", "billing", "finance"] },
    { label: "Settings", path: "/admin/settings", description: "System configuration", keywords: ["settings", "config"] },
  ],
  teacher: [
    { label: "Dashboard", path: "/teacher", description: "Overview & upcoming tasks" },
    { label: "Timetable", path: "/teacher/timetable", description: "Your class schedule", keywords: ["schedule", "classes", "periods"] },
    { label: "Attendance", path: "/teacher/attendance", description: "Mark student attendance", keywords: ["attendance", "mark", "absent", "present"] },
    { label: "Homework", path: "/teacher/homework", description: "Assign & manage homework", keywords: ["homework", "tasks", "assignments"] },
    { label: "Assignments", path: "/teacher/assignments", description: "Create & view assignments", keywords: ["assignments", "tasks", "coursework"] },
    { label: "Grading", path: "/teacher/grading", description: "Grade student submissions", keywords: ["grading", "grades", "marks", "scores"] },
    { label: "AI Tutor Management", path: "/teacher/ai-tutor", description: "Manage AI tutor content", keywords: ["ai", "tutor", "artificial intelligence"] },
    { label: "Live Class", path: "/teacher/video-conference", description: "Start a live video class", keywords: ["video", "conference", "live", "stream", "online"] },
    { label: "Recordings", path: "/teacher/recordings", description: "View class recordings", keywords: ["recordings", "video", "replay"] },
    { label: "Messages", path: "/teacher/messages", description: "Chat with students & parents", keywords: ["messages", "chat", "communication"] },
    { label: "AI Feedback", path: "/teacher/ai-feedback", description: "AI-generated feedback", keywords: ["ai", "feedback", "insights"] },
    { label: "Session Reports", path: "/teacher/insights", description: "Class insights & analytics", keywords: ["reports", "insights", "analytics", "data"] },
    { label: "Settings", path: "/teacher/settings", description: "Profile & preferences", keywords: ["settings", "profile", "preferences"] },
  ],
  student: [
    { label: "Dashboard", path: "/student", description: "Your overview" },
    { label: "Timetable", path: "/student/timetable", description: "Your class schedule", keywords: ["schedule", "classes", "periods", "timetable"] },
    { label: "Homework", path: "/student/homework", description: "Pending homework tasks", keywords: ["homework", "tasks", "due"] },
    { label: "Assignments", path: "/student/assignments", description: "Submit assignments", keywords: ["assignments", "submit", "coursework"] },
    { label: "Attendance", path: "/student/attendance", description: "Your attendance record", keywords: ["attendance", "absent", "present"] },
    { label: "Grades", path: "/student/grades", description: "View your grades", keywords: ["grades", "marks", "results", "scores"] },
    { label: "Class Recordings", path: "/student/class-recordings", description: "Watch recorded lessons", keywords: ["recordings", "video", "lessons", "replay"] },
    { label: "Transcript to Notes", path: "/student/transcript-to-notes", description: "Convert transcripts to notes", keywords: ["transcript", "notes", "ai", "convert"] },
    { label: "AI Tutor", path: "/student/ai-tutor", description: "Get AI-powered help", keywords: ["ai", "tutor", "help", "study", "artificial intelligence"] },
    { label: "Messages", path: "/student/messages", description: "Chat with teachers", keywords: ["messages", "chat", "communication"] },
    { label: "WhatsApp Alerts", path: "/student/whatsapp", description: "Notification settings", keywords: ["whatsapp", "notifications", "alerts"] },
    { label: "Settings", path: "/student/settings", description: "Profile & preferences", keywords: ["settings", "profile", "preferences"] },
  ],
  parent: [
    { label: "Dashboard", path: "/parent", description: "Child overview" },
    { label: "Attendance", path: "/parent/attendance", description: "Child attendance record", keywords: ["attendance", "absent", "present"] },
    { label: "Grades", path: "/parent/grades", description: "Child grades & results", keywords: ["grades", "marks", "results", "scores"] },
    { label: "Assignments", path: "/parent/assignments", description: "Child assignments status", keywords: ["assignments", "homework", "coursework"] },
    { label: "Fees", path: "/parent/fees", description: "School fees & payments", keywords: ["fees", "payments", "billing", "finance"] },
    { label: "Events & Exams", path: "/parent/events", description: "Upcoming events and exams", keywords: ["events", "exams", "calendar", "schedule"] },
    { label: "Messages", path: "/parent/messages", description: "Chat with teachers", keywords: ["messages", "chat", "communication"] },
    { label: "WhatsApp Alerts", path: "/parent/whatsapp", description: "Notification settings", keywords: ["whatsapp", "notifications", "alerts"] },
    { label: "Settings", path: "/parent/settings", description: "Profile & preferences", keywords: ["settings", "profile", "preferences"] },
  ],
};

export default function Header({ role }: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentChildId = params.childId ? parseInt(params.childId) : null;
  const currentChild = children.find((c) => c.id === currentChildId) ?? children[0] ?? null;

  // Fetch children from API when role is parent
  useEffect(() => {
    if (role !== "parent") return;
    setChildrenLoading(true);
    parentGetChildren()
      .then(setChildren)
      .catch(() => {/* silent — will fall back to showing id */})
      .finally(() => setChildrenLoading(false));
  }, [role]);

  // Close search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChildChange = (childId: number) => {
    localStorage.setItem("parent_child_id", String(childId));
    const currentPath = location.pathname;
    const newPath = currentPath.replace(/\/parent\/\d+/, `/parent/${childId}`);
    navigate(newPath);
    setShowChildSelector(false);
  };

  const items = searchConfig[role] ?? [];
  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      })
    : [];

  const handleSearchSelect = (path: string) => {
    const finalPath =
      role === "parent" && currentChildId
        ? path.replace("/parent", `/parent/${currentChildId}`)
        : path;
    navigate(finalPath);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchResults || filteredItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSelect(filteredItems[highlightedIndex].path);
    } else if (e.key === "Escape") {
      setShowSearchResults(false);
      setSearchQuery("");
    }
  };

  return (
    <header className="h-20 bg-white border-b border-gray-200 px-6 md:px-8 flex items-center justify-between sticky top-0 z-40 backdrop-blur-sm bg-white/80">
      {/* Search */}
      <div className="flex-1 max-w-xl" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedIndex(0);
              setShowSearchResults(e.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearchResults(true);
            }}
            onKeyDown={handleSearchKeyDown}
            className="pl-10 pr-4 py-2 w-full bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-gray-200"
          />

          <AnimatePresence>
            {showSearchResults && filteredItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
              >
                {filteredItems.map((item, idx) => (
                  <button
                    key={item.path}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSearchSelect(item.path);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                      idx === highlightedIndex ? "bg-gray-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <Search size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400">{item.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
            {showSearchResults && searchQuery.trim() && filteredItems.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-200 z-50"
              >
                <div className="px-4 py-3 text-sm text-gray-400">No results for "{searchQuery}"</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Child Selector (Parent Only) */}
        {role === "parent" && (
          <div className="relative">
            <button
              onClick={() => setShowChildSelector(!showChildSelector)}
              className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-200/50 rounded-full transition-all border border-green-200/50"
            >
              <div className="flex items-center gap-2">
                {childrenLoading ? (
                  <Loader2 size={18} className="text-green-600 animate-spin" />
                ) : (
                  <Users size={18} className="text-green-600" />
                )}
                <div className="text-left">
                  <p className="text-xs text-green-600 font-medium">Viewing</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {currentChild ? currentChild.name : `Student #${currentChildId ?? "—"}`}
                  </p>
                </div>
              </div>
              <ChevronDown size={16} className="text-green-600" />
            </button>

            <AnimatePresence>
              {showChildSelector && children.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
                >
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">SELECT CHILD</p>
                  </div>
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleChildChange(child.id)}
                      className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between hover:bg-green-50 ${
                        child.id === currentChildId ? "bg-green-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{child.name}</p>
                      </div>
                      {child.id === currentChildId && (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Profile */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <User size={18} />
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium">{getStoredFullName() || "User"}</p>
              <p className="text-xs text-gray-500">{roleLabels[role]}</p>
            </div>
            <ChevronDown size={16} className="text-gray-400 hidden md:block" />
          </motion.button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
              >
                <Link to={role === "parent" ? `/parent/${currentChildId}/settings` : `/${role}/settings`}>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    Profile Settings
                  </button>
                </Link>
                <div className="border-t border-gray-200 my-1" />
                <Link to="/">
                  <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors">
                    Logout
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
