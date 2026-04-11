// Application route definitions.
// All protected routes use requireRole() as a loader guard. If the user
// is not logged in they are redirected to the login page; if they have the
// wrong role they land on /unauthorized.
//
// Parent routes are structured as /parent/:childId/* so the selected child
// is always part of the URL. Visiting /parent without a childId redirects
// to the first child returned by the API.

import { createBrowserRouter } from "react-router";
import { redirect } from "react-router";
import { isAuthenticated, getStoredRole, parentGetChildren } from "@/app/utils/api";
import Unauthorized from "@/app/pages/Unauthorized";

function requireRole(role: string) {
  if (!isAuthenticated()) {
    // Preserve the intended destination so Login can redirect back after auth
    const from = encodeURIComponent(window.location.pathname + window.location.search);
    return redirect(`/?from=${from}`);
  }
  if (getStoredRole() !== role) {
    // Authenticated but wrong role
    return redirect("/unauthorized");
  }
  return null;
}
import Login from "@/app/pages/Login";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import AdminDashboard from "@/app/pages/admin/Dashboard";
import AdminUserManagement from "@/app/pages/admin/UserManagement";
import AdminClassSetup from "@/app/pages/admin/ClassSetup";
import AdminTimetableBuilder from "@/app/pages/admin/TimetableBuilder";
import AdminEventsCalendar from "@/app/pages/admin/EventsCalendar";
import AdminFeesOverview from "@/app/pages/admin/FeesOverview";
import AdminAttendanceOverview from "@/app/pages/admin/AttendanceOverview";
import AdminLocationsManagement from "@/app/pages/admin/LocationsManagement";
import AdminSettings from "@/app/pages/admin/Settings";
import TeacherDashboard from "@/app/pages/teacher/Dashboard";
import TeacherAttendance from "@/app/pages/teacher/Attendance";
import TeacherHomework from "@/app/pages/teacher/Homework";
import TeacherAssignments from "@/app/pages/teacher/Assignments";
import TeacherGrading from "@/app/pages/teacher/Grading";
import TeacherTimetable from "@/app/pages/teacher/Timetable";
import TeacherInsights from "@/app/pages/teacher/Insights";
import TeacherAIFeedback from "@/app/pages/teacher/AIFeedback";
import TeacherRecordings from "@/app/pages/teacher/Recordings";
import TeacherVideoConference from "@/app/pages/teacher/VideoConference";
import TeacherRecordingPlayer from "@/app/pages/teacher/RecordingPlayer";
import TeacherMessages from "@/app/pages/teacher/Messages";
import TeacherAITutorManagement from "@/app/pages/teacher/AITutorManagement";
import TeacherSettings from "@/app/pages/teacher/Settings";
import StudentDashboard from "@/app/pages/student/Dashboard";
import StudentTimetable from "@/app/pages/student/Timetable";
import StudentHomework from "@/app/pages/student/Homework";
import StudentAssignments from "@/app/pages/student/Assignments";
import StudentAttendance from "@/app/pages/student/Attendance";
import StudentGrades from "@/app/pages/student/Grades";
import StudentClassRecordings from "@/app/pages/student/ClassRecordings";
import StudentTranscriptToNotes from "@/app/pages/student/TranscriptToNotes";
import StudentAITutor from "@/app/pages/student/AITutor";
import StudentMessages from "@/app/pages/student/Messages";
import StudentSettings from "@/app/pages/student/Settings";
import StudentWhatsAppNotifications from "@/app/pages/student/WhatsAppNotifications";
import StudentLiveClass from "@/app/pages/student/StudentLiveClass";
import ParentDashboard from "@/app/pages/parent/Dashboard";
import ParentAttendance from "@/app/pages/parent/Attendance";
import ParentGrades from "@/app/pages/parent/Grades";
import ParentFees from "@/app/pages/parent/Fees";
import ParentEvents from "@/app/pages/parent/Events";
import ParentMessages from "@/app/pages/parent/Messages";
import ParentSettings from "@/app/pages/parent/Settings";
import ParentAssignments from "@/app/pages/parent/Assignments";
import ParentWhatsAppNotifications from "@/app/pages/parent/WhatsAppNotifications";
import StudentConsent from "@/app/pages/student/Consent";
import ParentConsent from "@/app/pages/parent/Consent";
import AdminConsentCompliance from "@/app/pages/admin/ConsentCompliance";
import ComponentLibrary from "@/app/pages/ComponentLibrary";

// Parent Portal Routing:
// - All parent routes require a childId parameter: /parent/:childId/*
// - Accessing /parent without childId redirects to /parent/1 (default first child)
// - Child selector in header allows switching between children
// - Navigation items automatically include the current childId in paths

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: "/admin",
    loader: () => requireRole("admin"),
    ErrorBoundary: ErrorBoundary,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "users", Component: AdminUserManagement },
      { path: "classes", Component: AdminClassSetup },
      { path: "timetable", Component: AdminTimetableBuilder },
      { path: "events", Component: AdminEventsCalendar },
      { path: "fees", Component: AdminFeesOverview },
      { path: "attendance", Component: AdminAttendanceOverview },
      { path: "locations", Component: AdminLocationsManagement },
      { path: "settings", Component: AdminSettings },
      { path: "consent", Component: AdminConsentCompliance },
      { path: "*", loader: () => redirect("/admin") },
    ],
  },
  {
    path: "/teacher",
    loader: () => requireRole("teacher"),
    ErrorBoundary: ErrorBoundary,
    children: [
      { index: true, Component: TeacherDashboard },
      { path: "attendance", Component: TeacherAttendance },
      { path: "homework", Component: TeacherHomework },
      { path: "assignments", Component: TeacherAssignments },
      { path: "grading", Component: TeacherGrading },
      { path: "timetable", Component: TeacherTimetable },
      { path: "insights", Component: TeacherInsights },
      { path: "ai-feedback", Component: TeacherAIFeedback },
      { path: "recordings", Component: TeacherRecordings },
      { path: "video-conference", Component: TeacherVideoConference },
      { path: "recording/:meetingId", Component: TeacherRecordingPlayer },
      { path: "ai-tutor", Component: TeacherAITutorManagement },
      { path: "messages", Component: TeacherMessages },
      { path: "settings", Component: TeacherSettings },
    ],
  },
  {
    path: "/student",
    loader: () => requireRole("student"),
    ErrorBoundary: ErrorBoundary,
    children: [
      { index: true, Component: StudentDashboard },
      { path: "timetable", Component: StudentTimetable },
      { path: "homework", Component: StudentHomework },
      { path: "assignments", Component: StudentAssignments },
      { path: "attendance", Component: StudentAttendance },
      { path: "grades", Component: StudentGrades },
      { path: "class-recordings", Component: StudentClassRecordings },
      { path: "transcript-to-notes", Component: StudentTranscriptToNotes },
      { path: "ai-tutor", Component: StudentAITutor },
      { path: "messages", Component: StudentMessages },
      { path: "settings", Component: StudentSettings },
      { path: "whatsapp", Component: StudentWhatsAppNotifications },
      { path: "live/:meetingId", Component: StudentLiveClass },
      { path: "consent", Component: StudentConsent },
    ],
  },
  {
    path: "/parent/:childId",
    loader: () => requireRole("parent"),
    ErrorBoundary: ErrorBoundary,
    children: [
      { index: true, Component: ParentDashboard },
      { path: "attendance", Component: ParentAttendance },
      { path: "grades", Component: ParentGrades },
      { path: "fees", Component: ParentFees },
      { path: "events", Component: ParentEvents },
      { path: "assignments", Component: ParentAssignments },
      { path: "messages", Component: ParentMessages },
      { path: "settings", Component: ParentSettings },
      { path: "consent", Component: ParentConsent },
      { path: "whatsapp", Component: ParentWhatsAppNotifications },
    ],
  },
  {
    path: "/parent",
    loader: async () => {
      if (!isAuthenticated() || getStoredRole() !== "parent") return redirect("/");
      try {
        const children = await parentGetChildren();
        if (children.length > 0) return redirect(`/parent/${children[0].id}`);
      } catch { }
      // No children linked — still enter parent portal so they see a message
      return redirect("/parent/0");
    },
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: "/unauthorized",
    Component: Unauthorized,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: "/components",
    Component: ComponentLibrary,
    ErrorBoundary: ErrorBoundary,
  },
]);