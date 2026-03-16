# Implementation Plan: Live Class and Timetable Integration

This plan outlines the changes required to connect live classes with the timetable dashboard, allowing teachers to start classes and mark attendance directly from their schedule, while ensuring students have a synchronized view.

## Proposed Changes

### [Component] Frontend - Teacher Dashboard

#### [MODIFY] [TeacherTimetable.tsx](file:///c:/Users/yukta/ConnectEd/frontend/src/app/pages/teacher/Timetable.tsx)
-   **Update Class Actions**: Modify the `renderClassCard` function to display two distinct primary actions for all scheduled classes (Online or On-site):
    1.  **Mark Attendance**: Redirects to the attendance marking page for the specific class.
    2.  **Start Class**: Redirects to the Live Class (Video Conference) dashboard.
-   **Navigation Logic**:
    -   Clicking **Mark Attendance** will navigate to `/teacher/attendance?classId=${entry.class_id}`.
    -   Clicking **Start Class** will navigate to `/teacher/video-conference?classId=${entry.class_id}&subjectId=${entry.subject_id}`.

#### [MODIFY] [VideoConference.tsx](file:///c:/Users/yukta/ConnectEd/frontend/src/app/pages/teacher/VideoConference.tsx)
-   **Field Autofill**:
    -   Implement logic to read `classId` and `subjectId` from the URL search parameters on component mount.
    -   Automatically set `selectedClassId` and `selectedSubjectId` based on these parameters.
    -   The existing `useEffect` hook will automatically generate the `sessionTitle` (e.g., "Grade 10-A — Mathematics") once these IDs are set.

---

### [Component] Frontend - Student Dashboard

#### [MODIFY] [StudentTimetable.tsx](file:///c:/Users/yukta/ConnectEd/frontend/src/app/pages/student/Timetable.tsx)
-   **Sync with Timetable**:
    -   Ensure the "Join Live Class" button is prominently displayed within the timetable grid for any class that has an active session started by the teacher.
    -   Enhance the "Live Now" banner to specifically highlight classes currently in progress on the student's schedule.

---

### [Component] Backend - API Enhancement (Optional/Contextual)

-   **Session Tracking**: Ensure that starting a meeting automatically triggers or links to an attendance session if desired. Currently, the existing POST `/video/meetings` and `/teachers/attendance/open` endpoints handle these separately. The plan assumes these stay as separate actions for maximum flexibility (e.g., marking attendance for a physical class while also broadcasting it).

## Verification Plan

### Manual Verification
1.  **Teacher Workflow**:
    -   Open the **Teacher Timetable**.
    -   Pick any upcoming class (even an on-site one).
    -   Click the **Start Class** button.
    -   Verify the browser redirects to the **Live Class** page with the **Class** and **Subject** already selected and the **Session Title** pre-filled.
    -   Go back and click **Mark Attendance**.
    -   Verify the browser redirects to the **Attendance** page for that specific class.
2.  **Student Workflow**:
    -   As a teacher, start a class from the timetable.
    -   Login as a student and open the **Student Timetable**.
    -   Verify that the "Live Now" banner appears and the specific class in the timetable grid shows a "Join Live Class" button.
    -   Click "Join Live Class" and verify successful entry into the room.
