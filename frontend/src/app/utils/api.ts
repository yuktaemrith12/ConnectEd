import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inject JWT from localStorage into every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 responses, clear storage and redirect to login (token expired/invalid).
// 403 responses are NOT redirected — components handle ownership-denial errors per-widget.
// EXCEPT for the login endpoint itself — let the Login page show its own errors.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isLoginRequest = url.includes("/auth/login");

    if (!isLoginRequest && error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_email");
      localStorage.removeItem("user_full_name");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// ── Auth helpers ─────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: { email: string; role: string; full_name: string };
}

export async function loginRequest(
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export function saveSession(data: LoginResponse): void {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("user_role", data.user.role);
  localStorage.setItem("user_email", data.user.email);
  localStorage.setItem("user_full_name", data.user.full_name);
}

export function clearSession(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_full_name");
}

export function getStoredRole(): string | null {
  return localStorage.getItem("user_role");
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("access_token");
}

export function getStoredFullName(): string {
  return localStorage.getItem("user_full_name") || "";
}

// ── Admin — Dashboard ─────────────────────────────────────────────────────────

export interface DashboardData {
  total_students: number;
  total_teachers: number;
  attendance_rate: number;
  unpaid_fees: number;
  attendance_trend: { month: string; rate: number }[];
  fee_status: { name: string; value: number; color: string }[];
  enrolment_data: { grade: string; students: number }[];
  upcoming_events: { title: string; date: string; type: string }[];
}

export async function adminGetDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>("/admin/dashboard");
  return data;
}

// ── Admin — Profile ───────────────────────────────────────────────────────────

export async function adminChangePassword(oldPassword: string, newPassword: string): Promise<{ detail: string }> {
  const { data } = await api.patch<{ detail: string }>("/admin/profile/password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

// ── Admin — Fees CSV Export ──────────────────────────────────────────────────

export async function adminExportFeesCsv(params?: {
  search?: string; class_id?: number; status?: string;
}): Promise<Blob> {
  const { data } = await api.get("/admin/fees/export/csv", {
    params,
    responseType: "blob",
  });
  return data as Blob;
}

// ── Admin types ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  class_name: string | null;
  is_active: boolean;
}

export interface AdminClass {
  id: number;
  name: string;
  head_teacher_id: number | null;
  head_teacher_name: string | null;
  student_count: number;
  subject_count: number;
}

export interface AdminSubject {
  id: number;
  name: string;
}

export interface TimetableSlot {
  day: string;
  time_slot: string;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  delivery_mode?: string;       // "ONLINE" | "ONSITE"
  location_id?: number | null;
  location_name?: string | null;
  online_join_url?: string | null;
}

export interface TeacherOption {
  id: number;
  full_name: string;
}

// ── Admin — Users ─────────────────────────────────────────────────────────────

export async function adminGetUsers(role?: string, search?: string): Promise<AdminUser[]> {
  const params: Record<string, string> = {};
  if (role) params.role = role;
  if (search) params.search = search;
  const { data } = await api.get<AdminUser[]>("/admin/users", { params });
  return data;
}

export async function adminToggleStatus(userId: number, isActive: boolean): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/admin/users/${userId}/status`, {
    is_active: isActive,
  });
  return data;
}

export async function adminAssignClass(userId: number, classId: number): Promise<AdminUser> {
  const { data } = await api.put<AdminUser>(`/admin/users/${userId}/class`, {
    class_id: classId,
  });
  return data;
}

export async function adminBulkImport(file: File): Promise<{ created: number; skipped: number }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/admin/users/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Admin — Classes & Subjects ────────────────────────────────────────────────

export async function adminGetClasses(): Promise<AdminClass[]> {
  const { data } = await api.get<AdminClass[]>("/admin/classes");
  return data;
}

export async function adminCreateClass(name: string): Promise<AdminClass> {
  const { data } = await api.post<AdminClass>("/admin/classes", { name });
  return data;
}

export interface SubjectTeacherMapping {
  subject_id: number;
  teacher_id: number;
}

export async function adminManageClass(
  classId: number,
  teacherId: number | null,
  subjectIds: number[],
  mappings: SubjectTeacherMapping[] = []
): Promise<AdminClass> {
  const { data } = await api.put<AdminClass>(`/admin/classes/${classId}/manage`, {
    teacher_id: teacherId,
    subject_ids: subjectIds,
    mappings,
  });
  return data;
}

export async function adminGetSubjects(): Promise<AdminSubject[]> {
  const { data } = await api.get<AdminSubject[]>("/admin/subjects");
  return data;
}

export async function adminGetClassMappings(classId: number): Promise<SubjectTeacherMapping[]> {
  const { data } = await api.get<SubjectTeacherMapping[]>(`/admin/classes/${classId}/mappings`);
  return data;
}

export async function adminGetSubjectTeachers(subjectId: number): Promise<TeacherOption[]> {
  const { data } = await api.get<TeacherOption[]>(`/admin/subjects/${subjectId}/teachers`);
  return data;
}

// ── Admin — Timetable ─────────────────────────────────────────────────────────

export async function adminGetTimetable(classId: number): Promise<TimetableSlot[]> {
  const { data } = await api.get<TimetableSlot[]>(`/admin/timetable/${classId}`);
  return data;
}

export async function adminSaveTimetable(
  classId: number,
  slots: TimetableSlot[]
): Promise<TimetableSlot[]> {
  const { data } = await api.post<TimetableSlot[]>(`/admin/timetable/${classId}/bulk`, { slots });
  return data;
}

export async function adminGetClassSubjects(classId: number): Promise<AdminSubject[]> {
  const { data } = await api.get<AdminSubject[]>(`/admin/classes/${classId}/subjects`);
  return data;
}

export async function adminGetClassSubjectTeachers(
  classId: number,
  subjectId: number
): Promise<TeacherOption[]> {
  const { data } = await api.get<TeacherOption[]>(`/admin/classes/${classId}/subjects/${subjectId}/teachers`);
  return data;
}

// ── Admin — User Management Upgrade ──────────────────────────────────────────

export interface UserCreatePayload {
  first_name: string;
  last_name: string;
  role: string;
  student?: {
    class_id?: number | null;
    dob?: string;
    address?: string;
    phone?: string;
  };
  teacher?: {
    subject_ids?: number[];
    dob?: string;
    address?: string;
    phone?: string;
    bio?: string;
  };
  parent?: {
    student_ids?: number[];
    relationship?: string;
    phone?: string;
    address?: string;
  };
}

export async function adminCreateUser(payload: UserCreatePayload): Promise<AdminUser> {
  const { data } = await api.post<AdminUser>("/admin/users", payload);
  return data;
}

export interface UserDetail extends AdminUser {
  student_code: string | null;
  staff_id: string | null;
  dob: string | null;
  address: string | null;
  phone: string | null;
  bio: string | null;
  subject_ids: number[];
  linked_student_ids: number[];
  linked_parent_ids: number[];
}

export async function adminGetUserDetail(userId: number): Promise<UserDetail> {
  const { data } = await api.get<UserDetail>(`/admin/users/${userId}/detail`);
  return data;
}

export interface LinkPayload {
  type: "parent_student" | "teacher_subject";
  target_ids: number[];
  relationship?: string;
}

export async function adminCreateLink(userId: number, payload: LinkPayload): Promise<void> {
  await api.post(`/admin/users/${userId}/links`, payload);
}

// ── Admin — User Lifecycle ────────────────────────────────────────────────────

export interface UserUpdatePayload {
  full_name?: string;
  is_active?: boolean;
  student?: {
    class_id?: number | null;
    dob?: string;
    address?: string;
    phone?: string;
  };
  teacher?: {
    subject_ids?: number[];
    dob?: string;
    address?: string;
    phone?: string;
    bio?: string;
  };
  parent?: {
    student_ids?: number[];
    relationship?: string;
    phone?: string;
    address?: string;
  };
}

export async function adminUpdateUser(userId: number, payload: UserUpdatePayload): Promise<AdminUser> {
  const { data } = await api.put<AdminUser>(`/admin/users/${userId}`, payload);
  return data;
}

export async function adminDeleteUser(userId: number): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}

export async function adminResetPassword(userId: number, newPassword: string): Promise<void> {
  await api.post(`/admin/users/${userId}/password`, { new_password: newPassword });
}

export interface StudentSearchResult {
  id: number;
  full_name: string;
  class_name: string | null;
}

export async function adminSearchStudents(q: string): Promise<StudentSearchResult[]> {
  const { data } = await api.get<StudentSearchResult[]>("/admin/students/search", { params: { q } });
  return data;
}

export async function adminExportUsers(role: string, search?: string): Promise<Blob> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  const { data } = await api.get(`/admin/export/${role}`, {
    params,
    responseType: "blob",
  });
  return data as Blob;
}

export async function adminRoleImport(
  role: string,
  file: File
): Promise<{ created: number; skipped: number; details: unknown[] }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/admin/import/${role}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Admin — Attendance ────────────────────────────────────────────────────────

export interface AttendanceStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  overall_rate: number;
  trend_pct: number;
}

export interface AttendanceTrendPoint { date: string; rate: number; }
export interface AttendanceDistribution { present: number; absent: number; late: number; }
export interface ClasswiseAttendance { class_name: string; rate: number; }
export interface ChronicAbsentee {
  student_id: number; student_name: string; class_name: string; attendance_rate: number;
}

export interface AttendanceDayRecord { date: string; status: string; }
export interface AttendanceRecordRead {
  id: number;
  student_id: number;
  student_name: string;
  student_code: string;
  class_name: string;
  date: string;
  status: string;
  marked_by: string;
  attendance_rate: number;
  history: AttendanceDayRecord[];
}

export async function adminGetAttendanceStats(range = "This Week"): Promise<AttendanceStats> {
  const { data } = await api.get<AttendanceStats>("/admin/attendance/stats", { params: { range } });
  return data;
}
export async function adminGetAttendanceTrend(range = "This Week"): Promise<AttendanceTrendPoint[]> {
  const { data } = await api.get<AttendanceTrendPoint[]>("/admin/attendance/trend", { params: { range } });
  return data;
}
export async function adminGetAttendanceDistribution(range = "This Week"): Promise<AttendanceDistribution> {
  const { data } = await api.get<AttendanceDistribution>("/admin/attendance/distribution", { params: { range } });
  return data;
}
export async function adminGetClasswiseAttendance(range = "This Week"): Promise<ClasswiseAttendance[]> {
  const { data } = await api.get<ClasswiseAttendance[]>("/admin/attendance/classwise", { params: { range } });
  return data;
}
export async function adminGetChronicAbsentees(): Promise<ChronicAbsentee[]> {
  const { data } = await api.get<ChronicAbsentee[]>("/admin/attendance/chronic");
  return data;
}
export async function adminGetAttendanceRecords(params?: {
  search?: string; class_id?: number; status?: string; date_from?: string; date_to?: string;
}): Promise<AttendanceRecordRead[]> {
  const { data } = await api.get<AttendanceRecordRead[]>("/admin/attendance/records", { params });
  return data;
}
export async function adminUpsertAttendance(payload: {
  student_id: number; date: string; status: string; remarks?: string;
}): Promise<void> {
  await api.post("/admin/attendance", payload);
}

// ── Admin — Fees ──────────────────────────────────────────────────────────────

export interface AcademicPeriodRead {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

export interface FeeInstallmentRead {
  id: number;
  amount: number;
  due_date: string;
  is_overdue: boolean;
}

export interface FeeStats {
  total_collected: number;
  total_outstanding: number;
  fully_paid_count: number;
  overdue_count: number;
  total_students: number;
}

export interface FeeTrendPoint { label: string; amount: number; }

export interface PaymentRecordRead {
  id: number; date: string; amount: number; payment_method: string; transaction_id: string | null;
}

export interface FeeStudentRead {
  fee_plan_id: number;
  student_id: number;
  student_code: string;
  name: string;
  class_name: string;
  base_amount: number;
  discount_amount: number;
  total_fee: number;
  amount_paid: number;
  outstanding_balance: number;
  status: "paid" | "partial" | "unpaid";
  due_date: string;
  is_overdue: boolean;
  academic_period: string | null;
  installments: FeeInstallmentRead[];
  payment_history: PaymentRecordRead[];
}

export interface BulkPlanResult { created: number; skipped: number; }

export async function adminGetAcademicPeriods(): Promise<AcademicPeriodRead[]> {
  const { data } = await api.get<AcademicPeriodRead[]>("/admin/fees/academic-periods");
  return data;
}
export async function adminCreateAcademicPeriod(payload: {
  name: string; start_date: string; end_date: string;
}): Promise<AcademicPeriodRead> {
  const { data } = await api.post<AcademicPeriodRead>("/admin/fees/academic-periods", payload);
  return data;
}
export async function adminGetFeeStats(): Promise<FeeStats> {
  const { data } = await api.get<FeeStats>("/admin/fees/stats");
  return data;
}
export async function adminGetFeeTrend(): Promise<FeeTrendPoint[]> {
  const { data } = await api.get<FeeTrendPoint[]>("/admin/fees/trend");
  return data;
}
export async function adminGetFeeStudents(params?: {
  search?: string; class_id?: number; status?: string;
}): Promise<FeeStudentRead[]> {
  const { data } = await api.get<FeeStudentRead[]>("/admin/fees/students", { params });
  return data;
}
export async function adminCreateFeePlan(payload: {
  student_id: number;
  base_amount: number;
  discount_amount?: number;
  due_date: string;
  academic_period_id?: number;
  installments?: { amount: number; due_date: string }[];
}): Promise<FeeStudentRead> {
  const { data } = await api.post<FeeStudentRead>("/admin/fees/plans", payload);
  return data;
}
export async function adminCreateFeePlansBulk(payload: {
  class_id?: number;
  base_amount: number;
  discount_amount?: number;
  due_date: string;
  academic_period_id?: number;
  installments?: { amount: number; due_date: string }[];
}): Promise<BulkPlanResult> {
  const { data } = await api.post<BulkPlanResult>("/admin/fees/plans/bulk", payload);
  return data;
}
export async function adminRecordPayment(payload: {
  fee_plan_id: number; amount_paid: number; payment_method: string; transaction_id?: string;
}): Promise<FeeStudentRead> {
  const { data } = await api.post<FeeStudentRead>("/admin/fees/payments", payload);
  return data;
}
export async function adminUpdateFeePlan(planId: number, payload: {
  base_amount?: number; discount_amount?: number; due_date?: string;
}): Promise<FeeStudentRead> {
  const { data } = await api.patch<FeeStudentRead>(`/admin/fees/plans/${planId}`, payload);
  return data;
}
export async function adminTriggerFeeNotifications(): Promise<{ detail: string; upcoming: number; due_today: number; overdue: number }> {
  const { data } = await api.post("/admin/fees/notifications/trigger");
  return data;
}

// ── Admin — Events / Calendar ─────────────────────────────────────────────────

export interface EventRead {
  id: number;
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  target_audience_type: string;
  description: string | null;
  published: boolean;
  created_by: string;
  created_at: string;
  class_ids: number[];
}

export interface EventCreatePayload {
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  target_audience_type: string;
  description?: string;
  published: boolean;
  class_ids: number[];
}

export async function adminGetEvents(params?: {
  month?: number; year?: number; type?: string; published_only?: boolean;
}): Promise<EventRead[]> {
  const { data } = await api.get<EventRead[]>("/admin/events", { params });
  return data;
}
export async function adminCreateEvent(payload: EventCreatePayload): Promise<EventRead> {
  const { data } = await api.post<EventRead>("/admin/events", payload);
  return data;
}
export async function adminUpdateEvent(eventId: number, payload: Partial<EventCreatePayload>): Promise<EventRead> {
  const { data } = await api.put<EventRead>(`/admin/events/${eventId}`, payload);
  return data;
}
export async function adminDeleteEvent(eventId: number): Promise<void> {
  await api.delete(`/admin/events/${eventId}`);
}
export async function adminToggleEventPublish(eventId: number): Promise<EventRead> {
  const { data } = await api.patch<EventRead>(`/admin/events/${eventId}/publish`);
  return data;
}

// ── Timetable Publish + Sync ──────────────────────────────────────────────────

export interface TimetableEntryOut {
  id: number;
  class_id: number;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  day: string;
  day_of_week: number | null;
  time_slot: string;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  online_link: string | null;
  is_published: boolean;
  delivery_mode: string | null;    // "ONLINE" | "ONSITE"
  location_name: string | null;
  online_join_url: string | null;
}

export async function getStudentTimetable(params?: {
  view?: "day" | "week";
  date?: string;
}): Promise<TimetableEntryOut[]> {
  const { data } = await api.get<TimetableEntryOut[]>("/students/timetable", { params });
  return data;
}

export async function getTeacherTimetable(params?: {
  view?: "day" | "week";
  date?: string;
}): Promise<TimetableEntryOut[]> {
  const { data } = await api.get<TimetableEntryOut[]>("/teachers/timetable", { params });
  return data;
}

export async function adminCreateTimetableEntry(payload: {
  class_id: number;
  subject_id: number;
  teacher_id?: number | null;
  day: string;
  time_slot: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  online_link?: string;
}): Promise<TimetableEntryOut> {
  const { data } = await api.post<TimetableEntryOut>("/admin/timetable/entries", payload);
  return data;
}

export async function adminUpdateTimetableEntry(
  entryId: number,
  payload: Record<string, unknown>
): Promise<TimetableEntryOut> {
  const { data } = await api.put<TimetableEntryOut>(`/admin/timetable/entries/${entryId}`, payload);
  return data;
}

export async function adminDeleteTimetableEntry(entryId: number): Promise<void> {
  await api.delete(`/admin/timetable/entries/${entryId}`);
}

export async function adminPublishTimetable(payload: {
  class_id: number;
  publish_all?: boolean;
}): Promise<{ detail: string; count: number }> {
  const { data } = await api.post<{ detail: string; count: number }>("/admin/timetable/publish", payload);
  return data;
}

// ── Session-based Attendance ───────────────────────────────────────────────────

export interface StudentAttendanceRow {
  student_id: number;
  student_name: string;
  student_code: string;
  status: string | null;
  note: string | null;
  marked_at: string | null;
}

export interface AttendanceSessionDetail {
  session_id: number;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  session_date: string;
  delivery_mode: string;
  location_name: string | null;
  online_join_url: string | null;
  status: string; // "OPEN" | "CLOSED" | "CANCELLED"
  roster: StudentAttendanceRow[];
}

export interface StudentSessionRecord {
  session_date: string;
  class_name: string;
  subject_name: string;
  time_slot: string;
  delivery_mode: string;
  status: string | null;
  note: string | null;
}

export interface StudentAttendanceSummary {
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  unmarked_count: number;
  attendance_rate: number;
  recent: StudentSessionRecord[];
}

export interface Location {
  id: number;
  name: string;
  type: string;
  capacity: number | null;
  is_active: boolean;
}

export interface AdminSessionRead {
  session_id: number;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  session_date: string;
  status: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  unmarked_count: number;
}

export interface AttendanceOverviewItem {
  class_name: string;
  subject_name: string;
  total_sessions: number;
  avg_attendance_rate: number;
}

// ── Teacher attendance ────────────────────────────────────────────────────────

export async function teacherGetMyClasses(): Promise<{ id: number; name: string }[]> {
  const { data } = await api.get<{ id: number; name: string }[]>("/teachers/attendance/my-classes");
  return data;
}

export async function teacherOpenSession(
  classId: number,
  sessionDate: string
): Promise<AttendanceSessionDetail> {
  const { data } = await api.post<AttendanceSessionDetail>("/teachers/attendance/open", {
    class_id: classId,
    session_date: sessionDate,
  });
  return data;
}

export async function teacherGetSession(sessionId: number): Promise<AttendanceSessionDetail> {
  const { data } = await api.get<AttendanceSessionDetail>(`/teachers/attendance/sessions/${sessionId}`);
  return data;
}

export async function teacherMarkAttendance(
  sessionId: number,
  records: { student_id: number; status: string; note?: string }[]
): Promise<AttendanceSessionDetail> {
  const { data } = await api.put<AttendanceSessionDetail>(
    `/teachers/attendance/sessions/${sessionId}/records`,
    { records }
  );
  return data;
}

export async function teacherCloseSession(sessionId: number): Promise<AttendanceSessionDetail> {
  const { data } = await api.post<AttendanceSessionDetail>(
    `/teachers/attendance/sessions/${sessionId}/close`
  );
  return data;
}

// ── Student attendance ────────────────────────────────────────────────────────

export async function getStudentAttendanceSummary(): Promise<StudentAttendanceSummary> {
  const { data } = await api.get<StudentAttendanceSummary>("/students/attendance");
  return data;
}

// ── Parent attendance ─────────────────────────────────────────────────────────

export interface ParentChild {
  id: number;
  name: string;
}

export async function parentGetChildren(): Promise<ParentChild[]> {
  const { data } = await api.get<ParentChild[]>("/parents/children");
  return data;
}

export async function getParentChildAttendance(studentId: number): Promise<StudentAttendanceSummary> {
  const { data } = await api.get<StudentAttendanceSummary>(`/parents/attendance/${studentId}`);
  return data;
}

export interface ParentPaymentRecord {
  id: number;
  date: string;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
}

export interface ParentFeeStatus {
  has_plan: boolean;
  status: string;  // "paid" | "partial" | "unpaid" | "overdue" | "no_plan"
  total_fee: number;
  amount_paid: number;
  outstanding_balance: number;
  due_date: string | null;
  is_overdue: boolean;
  academic_period: string | null;
  payment_history: ParentPaymentRecord[];
}

export interface ParentEventItem {
  id: number;
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
}

export interface ParentGradeItem {
  subject: string;
  assessment: string;
  date: string;
  grade: string;       // display string, e.g. "85 / 100"
  percentage: number;  // 0–100
}

export interface ParentGradesSummary {
  overall_grade: string | null;
  items: ParentGradeItem[];
}

export async function parentGetChildFees(studentId: number): Promise<ParentFeeStatus> {
  const { data } = await api.get<ParentFeeStatus>(`/parents/${studentId}/fees`);
  return data;
}

export async function parentGetChildEvents(studentId: number): Promise<ParentEventItem[]> {
  const { data } = await api.get<ParentEventItem[]>(`/parents/${studentId}/events`);
  return data;
}

export async function parentGetChildGrades(studentId: number): Promise<ParentGradesSummary> {
  const { data } = await api.get<ParentGradesSummary>(`/parents/${studentId}/grades`);
  return data;
}

// ── Admin — Locations ─────────────────────────────────────────────────────────

export async function adminGetLocations(activeOnly = false): Promise<Location[]> {
  const { data } = await api.get<Location[]>("/admin/locations", { params: { active_only: activeOnly } });
  return data;
}

export async function adminCreateLocation(payload: {
  name: string; type?: string; capacity?: number;
}): Promise<Location> {
  const { data } = await api.post<Location>("/admin/locations", payload);
  return data;
}

export async function adminUpdateLocation(
  id: number,
  payload: { name?: string; type?: string; capacity?: number; is_active?: boolean }
): Promise<Location> {
  const { data } = await api.put<Location>(`/admin/locations/${id}`, payload);
  return data;
}

export async function adminDeactivateLocation(id: number): Promise<void> {
  await api.delete(`/admin/locations/${id}`);
}

// ── Admin — Attendance Sessions ────────────────────────────────────────────────

export async function adminGetAttendanceSessions(params?: {
  class_id?: number; date_from?: string; date_to?: string; status?: string;
}): Promise<AdminSessionRead[]> {
  const { data } = await api.get<AdminSessionRead[]>("/admin/attendance/sessions", { params });
  return data;
}

export async function adminGetAttendanceOverview(): Promise<AttendanceOverviewItem[]> {
  const { data } = await api.get<AttendanceOverviewItem[]>("/admin/attendance/overview");
  return data;
}

// ── Homework ─────────────────────────────────────────────────────────────────

export interface HomeworkAttachmentRead {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
}

export interface HomeworkRead {
  id: number;
  class_id: number;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number;
  teacher_name: string | null;
  title: string;
  instructions: string | null;
  due_at: string | null;
  status: "DRAFT" | "PUBLISHED";
  created_at: string | null;
  updated_at: string | null;
  attachments: HomeworkAttachmentRead[];
  is_done: boolean;
  done_at: string | null;
}

export interface TeacherClassSubjects {
  id: number;
  name: string;
  subjects: { id: number; name: string }[];
}

// ── Teacher Homework API ─────────────────────────────────────────────────────

export async function teacherGetHomeworkClasses(): Promise<TeacherClassSubjects[]> {
  const { data } = await api.get<TeacherClassSubjects[]>("/homework/teacher/my-classes");
  return data;
}

export async function teacherGetHomework(params?: {
  class_id?: number; subject_id?: number; status?: string;
}): Promise<HomeworkRead[]> {
  const { data } = await api.get<HomeworkRead[]>("/homework/teacher", { params });
  return data;
}

export async function teacherCreateHomework(
  params: Record<string, string>,
  formData: FormData
): Promise<HomeworkRead> {
  const { data } = await api.post<HomeworkRead>("/homework/teacher", formData, {
    params,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function teacherUpdateHomework(
  homeworkId: number,
  params: Record<string, string>,
  formData: FormData
): Promise<HomeworkRead> {
  const { data } = await api.put<HomeworkRead>(`/homework/teacher/${homeworkId}`, formData, {
    params,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function teacherDeleteHomework(homeworkId: number): Promise<void> {
  await api.delete(`/homework/teacher/${homeworkId}`);
}

export async function teacherPublishHomework(homeworkId: number): Promise<HomeworkRead> {
  const { data } = await api.post<HomeworkRead>(`/homework/teacher/${homeworkId}/publish`);
  return data;
}

export async function teacherDeleteAttachment(attachmentId: number): Promise<void> {
  await api.delete(`/homework/teacher/attachments/${attachmentId}`);
}

// ── Student Homework API ─────────────────────────────────────────────────────

export async function studentGetHomework(params?: {
  subject_id?: number;
}): Promise<HomeworkRead[]> {
  const { data } = await api.get<HomeworkRead[]>("/homework/student", { params });
  return data;
}

export async function studentToggleHomework(homeworkId: number): Promise<{
  homework_id: number; is_done: boolean; done_at: string | null;
}> {
  const { data } = await api.post(`/homework/student/${homeworkId}/toggle`);
  return data;
}

// ── Assignments ───────────────────────────────────────────────────────────────

export interface AssignmentAttachmentRead {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
}

export interface RubricCriterion {
  criterion: string;
  description?: string;
  max_points: number;
}

export interface KeyCorrection {
  misconception: string;
  correction: string;
}

export interface StructuredFeedback {
  grade_summary: string | null;
  strengths: string[];
  areas_to_improve: string[];
  key_corrections: KeyCorrection[];
  next_steps: string[];
  breakdown: string | null;
  summary_paragraph: string | null;
}

export interface AIReviewRead {
  id: number;
  suggested_grade: number | null;
  suggested_feedback: string | null;
  structured_feedback: StructuredFeedback | null;
  rubric_alignment: Record<string, string> | null;
  annotations: unknown[] | null;
  confidence_score: "low" | "medium" | "high";
  model_info: Record<string, unknown> | null;
  created_at: string;
}

export interface SubmissionAttachmentRead {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
}

export interface SubmissionRead {
  id: number;
  assignment_id: number;
  student_id: number;
  student_name: string | null;
  student_code: string | null;
  submitted_at: string | null;
  files: unknown;
  grade: number | null;
  feedback: string | null;
  status: "PENDING" | "SUBMITTED" | "GRADED" | "PUBLISHED";
  ai_reviewed: boolean;
  created_at: string | null;
  updated_at: string | null;
  sub_attachments: SubmissionAttachmentRead[];
  ai_reviews: AIReviewRead[];
}

export interface AssignmentRead {
  id: number;
  class_id: number;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number;
  teacher_name: string | null;
  type: "ONLINE" | "ON_SITE";
  title: string;
  description: string | null;
  due_at: string | null;
  max_score: number;
  rubric: RubricCriterion[] | null;
  location: string | null;
  duration: string | null;
  answer_sheet_url: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "RELEASED";
  created_at: string | null;
  updated_at: string | null;
  attachments: AssignmentAttachmentRead[];
  submission_count: number;
  graded_count: number;
  /** Only present in student/parent views */
  submission?: SubmissionRead | null;
}

export interface LocationRead {
  id: number;
  name: string;
  type: string;
  capacity: number | null;
}

export interface OnsiteRosterEntry {
  student_id: number;
  student_name: string | null;
  student_code: string | null;
  submission_status: "PENDING" | "SUBMITTED" | "GRADED" | "PUBLISHED";
  grade: number | null;
  feedback: string | null;
  submission_id: number | null;
}

// ── Teacher Assignment API ────────────────────────────────────────────────────

export async function teacherGetAssignmentClasses(): Promise<TeacherClassSubjects[]> {
  const { data } = await api.get<TeacherClassSubjects[]>("/assignments/teacher/my-classes");
  return data;
}

export async function teacherGetAssignments(params?: {
  class_id?: number; subject_id?: number; status?: string; type?: string;
}): Promise<AssignmentRead[]> {
  const { data } = await api.get<AssignmentRead[]>("/assignments/teacher", { params });
  return data;
}

export async function teacherCreateAssignment(
  params: Record<string, string | number | boolean>,
  formData: FormData,
): Promise<AssignmentRead> {
  const { data } = await api.post<AssignmentRead>("/assignments/teacher", formData, {
    params,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function teacherUpdateAssignment(
  assignmentId: number,
  params: Record<string, string | number | boolean>,
  formData: FormData,
): Promise<AssignmentRead> {
  const { data } = await api.put<AssignmentRead>(`/assignments/teacher/${assignmentId}`, formData, {
    params,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function teacherDeleteAssignment(assignmentId: number): Promise<void> {
  await api.delete(`/assignments/teacher/${assignmentId}`);
}

export async function teacherPublishAssignment(assignmentId: number): Promise<{ id: number; status: string }> {
  const { data } = await api.post(`/assignments/teacher/${assignmentId}/publish`);
  return data;
}

export async function teacherCloseAssignment(assignmentId: number): Promise<{ id: number; status: string }> {
  const { data } = await api.post(`/assignments/teacher/${assignmentId}/close`);
  return data;
}

export async function teacherDeleteAssignmentAttachment(attachmentId: number): Promise<void> {
  await api.delete(`/assignments/teacher/attachments/${attachmentId}`);
}

export async function teacherGetLocations(): Promise<LocationRead[]> {
  const { data } = await api.get<LocationRead[]>("/assignments/teacher/locations");
  return data;
}

export async function teacherGetOnsiteRoster(assignmentId: number): Promise<OnsiteRosterEntry[]> {
  const { data } = await api.get<OnsiteRosterEntry[]>(`/assignments/${assignmentId}/onsite-roster`);
  return data;
}

export async function teacherGetSubmissions(assignmentId: number): Promise<SubmissionRead[]> {
  const { data } = await api.get<SubmissionRead[]>(`/assignments/${assignmentId}/submissions`);
  return data;
}

export async function gradingOnsite(
  assignmentId: number,
  studentId: number,
  grade: number,
  feedback?: string,
): Promise<{ submission_id: number; student_id: number; grade: number; status: string }> {
  const { data } = await api.post("/assignments/grading/onsite", null, {
    params: { assignment_id: assignmentId, student_id: studentId, grade, feedback },
  });
  return data;
}

export async function gradingManual(
  submissionId: number,
  grade: number,
  feedback?: string,
): Promise<{ submission_id: number; grade: number; status: string }> {
  const { data } = await api.post("/assignments/grading/manual", null, {
    params: { submission_id: submissionId, grade, feedback },
  });
  return data;
}

export async function gradingAIReview(assignmentId: number): Promise<{ reviewed: number }> {
  const { data } = await api.post(`/assignments/grading/ai-review/${assignmentId}`);
  return data;
}

export async function gradingPublish(assignmentId: number): Promise<{ published: number }> {
  const { data } = await api.post(`/assignments/grading/publish/${assignmentId}`);
  return data;
}

// ── Student Assignment API ────────────────────────────────────────────────────

export async function studentGetAssignments(params?: {
  subject_id?: number;
}): Promise<AssignmentRead[]> {
  const { data } = await api.get<AssignmentRead[]>("/assignments/student", { params });
  return data;
}

export async function studentSubmitAssignment(
  assignmentId: number,
  formData: FormData,
): Promise<SubmissionRead> {
  const { data } = await api.post<SubmissionRead>(`/assignments/${assignmentId}/submit`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Parent Assignment API ─────────────────────────────────────────────────────

export async function parentGetAssignments(studentId: number): Promise<AssignmentRead[]> {
  const { data } = await api.get<AssignmentRead[]>(`/assignments/parent/${studentId}`);
  return data;
}

// ── Teacher Stats ─────────────────────────────────────────────────────────────

export interface TeacherStats {
  total_students: number;
  avg_attendance_rate: number;
}

export async function teacherGetStats(): Promise<TeacherStats> {
  const { data } = await api.get<TeacherStats>("/teachers/stats");
  return data;
}

// ── Messaging Types ───────────────────────────────────────────────────────────

export interface MsgContact {
  id: number;
  full_name: string;
  role: string;
}

export interface MsgConversation {
  id: number;
  type: string;
  other_user_id: number;
  other_user_name: string;
  other_user_role: string;
  last_message_preview: string | null;
  unread_count: number;
  updated_at: string;
}

export interface MsgMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  content_type: string;
  is_deleted: boolean;
  created_at: string;
  is_mine: boolean;
}

export interface MsgConversationDetail {
  id: number;
  type: string;
  other_user_id: number;
  other_user_name: string;
  other_user_role: string;
  messages: MsgMessage[];
}

// ── Messaging API ─────────────────────────────────────────────────────────────

export async function msgGetContacts(): Promise<MsgContact[]> {
  const { data } = await api.get<MsgContact[]>("/messages/contacts");
  return data;
}

export async function msgGetConversations(): Promise<MsgConversation[]> {
  const { data } = await api.get<MsgConversation[]>("/messages/conversations");
  return data;
}

export async function msgStartConversation(
  other_user_id: number,
  initial_message?: string,
): Promise<MsgConversation> {
  const { data } = await api.post<MsgConversation>("/messages/conversations", {
    other_user_id,
    initial_message: initial_message ?? null,
  });
  return data;
}

export async function msgGetConversation(
  convId: number,
  before_id?: number,
): Promise<MsgConversationDetail> {
  const { data } = await api.get<MsgConversationDetail>(`/messages/conversations/${convId}`, {
    params: before_id != null ? { before_id, limit: 50 } : { limit: 50 },
  });
  return data;
}

export async function msgSendMessage(convId: number, content: string): Promise<MsgMessage> {
  const { data } = await api.post<MsgMessage>(`/messages/conversations/${convId}/send`, { content });
  return data;
}

export async function msgMarkRead(convId: number): Promise<void> {
  await api.patch(`/messages/conversations/${convId}/read`);
}

// ── Profile Types & API ────────────────────────────────────────────────────────

export interface TeacherProfileData {
  full_name: string;
  email: string;
  staff_id: string | null;
  phone: string | null;
  dob: string | null;
  subjects: string | null;
}

export interface StudentProfileData {
  full_name: string;
  email: string;
  student_code: string | null;
  class_name: string | null;
  dob: string | null;
  phone: string | null;
}

export interface ParentProfileData {
  full_name: string;
  email: string;
  children: { id: number; name: string }[];
}

export async function teacherGetProfile(): Promise<TeacherProfileData> {
  const { data } = await api.get<TeacherProfileData>("/teachers/profile");
  return data;
}

export async function teacherChangePassword(oldPassword: string, newPassword: string): Promise<{ detail: string }> {
  const { data } = await api.patch<{ detail: string }>("/teachers/profile/password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

export async function studentGetProfile(): Promise<StudentProfileData> {
  const { data } = await api.get<StudentProfileData>("/students/profile");
  return data;
}

export async function studentChangePassword(oldPassword: string, newPassword: string): Promise<{ detail: string }> {
  const { data } = await api.patch<{ detail: string }>("/students/profile/password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

export async function parentGetProfile(): Promise<ParentProfileData> {
  const { data } = await api.get<ParentProfileData>("/parents/profile");
  return data;
}

export async function parentChangePassword(oldPassword: string, newPassword: string): Promise<{ detail: string }> {
  const { data } = await api.patch<{ detail: string }>("/parents/profile/password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

// ── WhatsApp Notification Settings ───────────────────────────────────────────

export interface WhatsAppSettings {
  is_connected: boolean;
  phone_number: string | null;
  notify_exams: boolean;
  notify_events: boolean;
  notify_attendance: boolean;
  notify_messages: boolean;
  notify_grades: boolean;
  notify_assignments: boolean;
  notify_due_reminders: boolean;
}

export interface WhatsAppSettingsUpdate {
  phone_number?: string | null;
  notify_exams?: boolean;
  notify_events?: boolean;
  notify_attendance?: boolean;
  notify_messages?: boolean;
  notify_grades?: boolean;
  notify_assignments?: boolean;
  notify_due_reminders?: boolean;
}

export async function parentGetWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { data } = await api.get<WhatsAppSettings>("/parents/whatsapp/settings");
  return data;
}

export async function parentUpdateWhatsAppSettings(
  update: WhatsAppSettingsUpdate
): Promise<WhatsAppSettings> {
  const { data } = await api.patch<WhatsAppSettings>("/parents/whatsapp/settings", update);
  return data;
}

export async function parentDisconnectWhatsApp(): Promise<void> {
  await api.post("/parents/whatsapp/disconnect");
}

export async function studentGetWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { data } = await api.get<WhatsAppSettings>("/whatsapp/settings");
  return data;
}

export async function studentUpdateWhatsAppSettings(
  update: WhatsAppSettingsUpdate
): Promise<WhatsAppSettings> {
  const { data } = await api.patch<WhatsAppSettings>("/whatsapp/settings", update);
  return data;
}

export async function studentDisconnectWhatsApp(): Promise<void> {
  await api.post("/whatsapp/disconnect");
}

// ── Transcript to Notes ───────────────────────────────────────────────────────

export interface T2NJob {
  job_id: number;
  status: "processing" | "completed" | "failed";
  current_stage: string | null;
  language: string;
  source_reference: string | null;
  transcript: string | null;
  notes_markdown: string | null;
  illustration_url: string | null;
  error_message: string | null;
  created_at: string | null;
}

export interface T2NHistoryItem {
  job_id: number;
  status: "processing" | "completed" | "failed";
  current_stage: string | null;
  language: string;
  source_reference: string | null;
  created_at: string | null;
}

export async function t2nUpload(
  file: File,
  language: string
): Promise<{ job_id: number; status: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  const { data } = await api.post<{ job_id: number; status: string }>(
    "/transcript-to-notes/upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function t2nGetJob(jobId: number): Promise<T2NJob> {
  const { data } = await api.get<T2NJob>(`/transcript-to-notes/jobs/${jobId}`);
  return data;
}

export async function t2nGetHistory(): Promise<T2NHistoryItem[]> {
  const { data } = await api.get<T2NHistoryItem[]>("/transcript-to-notes/history");
  return data;
}

// ── AI Tutor ──────────────────────────────────────────────────────────────────

export interface ClassSubjectRead {
  class_id:    number;
  class_name:  string;
  subject_id:  number;
  subject_name: string;
}

export interface AiTutorRead {
  id:              number;
  class_id:        number;
  class_name:      string;
  subject_id:      number;
  subject_name:    string;
  teacher_id:      number;
  display_name:    string | null;
  system_prompt:   string | null;
  personality:     string;
  teaching_style:  string;
  tone:            string;
  emphasis_topics: string[] | null;
  icon_emoji:      string | null;
  is_active:       boolean;
  doc_count:       number;
  chapter_count:   number;
  created_at:      string;
}

export interface AiTutorChapterRead {
  id:           number;
  tutor_id:     number;
  term:         string | null;
  chapter_name: string | null;
  topic:        string | null;
  sort_order:   number;
  is_unlocked:  boolean;
  doc_count:    number;
  created_at:   string;
}

export interface AiTutorDocumentRead {
  id:                number;
  tutor_id:          number;
  chapter_id:        number | null;
  chapter_name:      string | null;
  doc_type:          string;
  original_filename: string;
  file_size_bytes:   number;
  mime_type:         string;
  is_indexed:        boolean;
  is_enabled:        boolean;
  created_at:        string;
}

export interface AiTutorDetail extends AiTutorRead {
  chapters:  AiTutorChapterRead[];
  documents: AiTutorDocumentRead[];
}

export interface AiTutorTranscriptRead {
  id:                  number;
  tutor_id:            number;
  chapter_id:          number | null;
  raw_transcript:      string | null;
  approved_transcript: string | null;
  status:              "pending" | "approved" | "rejected";
  reviewed_by:         number | null;
  reviewed_at:         string | null;
  is_indexed:          boolean;
  is_enabled:          boolean;
  created_at:          string;
}

export interface AiTutorSourceCitation {
  document_id:   number | null;
  transcript_id: number | null;
  filename:      string | null;
  doc_type:      string | null;
  chunk_text:    string;
  chunk_index:   number;
}

export interface AiTutorInfographicRead {
  id:                 number;
  tutor_id:           number;
  message_id:         number;
  normalized_concept: string | null;
  accessibility_alt:  string | null;
  url:                string;   // e.g. /api/v1/ai-tutor/infographics/{id}
  created_at:         string;
}

export interface AiTutorChatResponse {
  session_id:    number;
  message_id:    number;
  content:       string;
  sources:       AiTutorSourceCitation[];
  confidence:    "high" | "medium" | "low" | null;
  response_type: string | null;
  infographic:   AiTutorInfographicRead | null;
}

export interface AiTutorChatMessageRead {
  id:            number;
  session_id:    number;
  role:          "user" | "assistant" | "system";
  content:       string;
  sources:       AiTutorSourceCitation[];
  confidence:    "high" | "medium" | "low" | null;
  response_type: string | null;
  created_at:    string;
}

export interface AiTutorSessionRead {
  id:               number;
  tutor_id:         number;
  tutor_name:       string | null;
  subject_name:     string;
  mode:             string;
  started_at:       string;
  last_activity_at: string;
  message_count:    number;
}

export interface StudentTutorRead {
  id:            number;
  class_id:      number;
  class_name:    string;
  subject_id:    number;
  subject_name:  string;
  display_name:  string | null;
  icon_emoji:    string | null;
  doc_count:     number;
  chapter_count: number;
}

// Teacher API functions
export async function aiGetTeacherClassSubjects(): Promise<ClassSubjectRead[]> {
  const { data } = await api.get<ClassSubjectRead[]>("/ai-tutor/teacher/class-subjects");
  return data;
}

export async function aiGetTeacherTutors(): Promise<AiTutorRead[]> {
  const { data } = await api.get<AiTutorRead[]>("/ai-tutor/tutors/");
  return data;
}

export async function aiCreateTutor(body: {
  class_id: number;
  subject_id: number;
  display_name?: string;
  is_active?: boolean;
}): Promise<AiTutorRead> {
  const { data } = await api.post<AiTutorRead>("/ai-tutor/tutors/", body);
  return data;
}

export async function aiGetTutor(id: number): Promise<AiTutorDetail> {
  const { data } = await api.get<AiTutorDetail>(`/ai-tutor/tutors/${id}`);
  return data;
}

export async function aiUpdateTutor(id: number, body: {
  display_name?: string;
  system_prompt?: string;
  is_active?: boolean;
  personality?: string;
  teaching_style?: string;
  tone?: string;
  emphasis_topics?: string[];
  icon_emoji?: string;
}): Promise<AiTutorRead> {
  const { data } = await api.patch<AiTutorRead>(`/ai-tutor/tutors/${id}`, body);
  return data;
}

export async function aiDeleteTutor(id: number): Promise<void> {
  await api.delete(`/ai-tutor/tutors/${id}`);
}

export async function aiCreateChapter(tutorId: number, body: {
  term: string;
  chapter_name: string;
  topic?: string;
  sort_order?: number;
}): Promise<AiTutorChapterRead> {
  const { data } = await api.post<AiTutorChapterRead>(`/ai-tutor/tutors/${tutorId}/chapters/`, body);
  return data;
}

export async function aiGetChapters(tutorId: number): Promise<AiTutorChapterRead[]> {
  const { data } = await api.get<AiTutorChapterRead[]>(`/ai-tutor/tutors/${tutorId}/chapters/`);
  return data;
}

export async function aiUpdateChapter(id: number, body: {
  term?: string;
  chapter_name?: string;
  topic?: string;
  sort_order?: number;
  is_unlocked?: boolean;
}): Promise<AiTutorChapterRead> {
  const { data } = await api.patch<AiTutorChapterRead>(`/ai-tutor/chapters/${id}`, body);
  return data;
}

export async function aiDeleteChapter(id: number): Promise<void> {
  await api.delete(`/ai-tutor/chapters/${id}`);
}

export async function aiUploadDocuments(tutorId: number, formData: FormData): Promise<AiTutorDocumentRead[]> {
  const { data } = await api.post<AiTutorDocumentRead[]>(
    `/ai-tutor/tutors/${tutorId}/documents/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function aiGetDocuments(tutorId: number): Promise<AiTutorDocumentRead[]> {
  const { data } = await api.get<AiTutorDocumentRead[]>(`/ai-tutor/tutors/${tutorId}/documents/`);
  return data;
}

export async function aiUpdateDocument(id: number, body: {
  is_enabled?: boolean;
  chapter_id?: number;
  doc_type?: string;
}): Promise<AiTutorDocumentRead> {
  const { data } = await api.patch<AiTutorDocumentRead>(`/ai-tutor/documents/${id}`, body);
  return data;
}

export async function aiDeleteDocument(id: number): Promise<void> {
  await api.delete(`/ai-tutor/documents/${id}`);
}

export async function aiGetTranscripts(tutorId: number, status?: string): Promise<AiTutorTranscriptRead[]> {
  const { data } = await api.get<AiTutorTranscriptRead[]>(
    `/ai-tutor/tutors/${tutorId}/transcripts/`,
    { params: status ? { status } : {} },
  );
  return data;
}

export async function aiApproveTranscript(id: number, body: {
  edited_transcript?: string;
  chapter_id?: number;
}): Promise<AiTutorTranscriptRead> {
  const { data } = await api.post<AiTutorTranscriptRead>(`/ai-tutor/transcripts/${id}/approve`, body);
  return data;
}

export async function aiRejectTranscript(id: number): Promise<void> {
  await api.post(`/ai-tutor/transcripts/${id}/reject`);
}

// Student API functions
export async function aiGetStudentTutors(): Promise<StudentTutorRead[]> {
  const { data } = await api.get<StudentTutorRead[]>("/ai-tutor/student/tutors/");
  return data;
}

export async function aiStudentChat(body: {
  tutor_id: number;
  session_id?: number;
  mode: string;
  message: string;
  difficulty?: string;
}): Promise<AiTutorChatResponse> {
  const { data } = await api.post<AiTutorChatResponse>("/ai-tutor/student/chat/", body);
  return data;
}

export async function aiExerciseVariation(body: {
  tutor_id: number;
  exercise_description: string;
  mode?: string;
  difficulty?: string;
}): Promise<{ content: string; sources: AiTutorSourceCitation[]; confidence: string | null }> {
  const { data } = await api.post("/ai-tutor/student/exercise-variation/", body);
  return data;
}

export async function aiGetSessions(): Promise<AiTutorSessionRead[]> {
  const { data } = await api.get<AiTutorSessionRead[]>("/ai-tutor/student/sessions/");
  return data;
}

export async function aiGetSessionMessages(sessionId: number): Promise<AiTutorChatMessageRead[]> {
  const { data } = await api.get<AiTutorChatMessageRead[]>(`/ai-tutor/student/sessions/${sessionId}/messages`);
  return data;
}

// ── Video Conferencing ────────────────────────────────────────────────────────

export interface MeetingRecordingRead {
  id: number;
  meeting_id: number;
  storage_path: string;
  duration_s: number;
  has_transcript: boolean;
  has_analytics: boolean;
  created_at: string | null;
}

export interface MeetingRead {
  id: number;
  room_name: string;
  teacher_id: number;
  teacher_name: string | null;
  class_id: number;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
  title: string;
  status: "active" | "completed" | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  livekit_url: string | null;
  participant_token: string | null;
  recording_count: number;
  recordings: MeetingRecordingRead[];
}

export interface MeetingAnalyticsRead {
  id: number;
  meeting_id: number;
  report_json: {
    emotion_summary?: Record<string, number>;
    confusion_peaks?: { topic: string; description: string }[];
    ai_suggestions?: string[];
    engagement_score?: number | null;
    summary?: string | null;
    transcript_snippet?: string | null;
  } | null;
}

export interface EmotionTimelinePoint {
  timestamp_s: number;
  engagement?: number;
  confusion?: number;
  boredom?: number;
  frustration?: number;
  understanding?: number;
}

export interface MeetingCreate {
  class_id: number;
  subject_id: number;
  title: string;
}

export async function videoStartMeeting(payload: MeetingCreate): Promise<MeetingRead> {
  const { data } = await api.post<MeetingRead>("/video/meetings", payload);
  return data;
}

export async function videoListMeetings(status?: string): Promise<MeetingRead[]> {
  const { data } = await api.get<MeetingRead[]>("/video/meetings", {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function videoGetMeeting(meetingId: number): Promise<MeetingRead> {
  const { data } = await api.get<MeetingRead>(`/video/meetings/${meetingId}`);
  return data;
}

export async function videoJoinMeeting(meetingId: number): Promise<MeetingRead> {
  const { data } = await api.get<MeetingRead>(`/video/meetings/${meetingId}/join`);
  return data;
}

export async function videoEndMeeting(meetingId: number): Promise<MeetingRead> {
  const { data } = await api.post<MeetingRead>(`/video/meetings/${meetingId}/end`);
  return data;
}

export async function videoGetAnalytics(meetingId: number): Promise<MeetingAnalyticsRead> {
  const { data } = await api.get<MeetingAnalyticsRead>(`/video/meetings/${meetingId}/analytics`);
  return data;
}

export async function videoGetEmotionTimeline(
  meetingId: number
): Promise<{ meeting_id: number; timeline: EmotionTimelinePoint[] }> {
  const { data } = await api.get(`/video/meetings/${meetingId}/emotion-timeline`);
  return data;
}

export async function videoGetActiveMeetings(classId?: number): Promise<MeetingRead[]> {
  const params = classId ? { class_id: classId } : {};
  const { data } = await api.get<MeetingRead[]>("/video/active-meetings", { params });
  return data;
}

export async function videoTriggerProcessing(
  meetingId: number,
): Promise<{ status: string; recording_id: number }> {
  const { data } = await api.post(`/video/meetings/${meetingId}/trigger-processing`);
  return data;
}

export async function videoGetCompletedMeetings(): Promise<MeetingRead[]> {
  const { data } = await api.get<MeetingRead[]>("/video/completed-meetings");
  return data;
}

export async function videoGetTranscript(
  meetingId: number,
): Promise<{ meeting_id: number; transcript: string; partial?: boolean }> {
  const { data } = await api.get(`/video/meetings/${meetingId}/transcript`);
  return data;
}

export async function t2nFromRecording(
  meetingId: number,
  language = "en",
): Promise<{ job_id: number; status: string }> {
  const { data } = await api.post(`/transcript-to-notes/from-recording/${meetingId}`, null, {
    params: { language },
  });
  return data;
}

// ── Consent Management ────────────────────────────────────────────────────────

export type ConsentStatus = "pending" | "granted" | "refused" | "withdrawn" | "expired";
export type ConsentType = "emotion_detection" | "session_recording" | "transcript_generation";

export interface ConsentRecord {
  id: number;
  student_id: number;
  consent_type: ConsentType;
  status: ConsentStatus;
  granted_by: number | null;
  granted_by_name: string | null;
  consent_version: string;
  expiry_date: string | null;
  ip_address: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConsentChoiceItem {
  consent_type: ConsentType;
  status: "granted" | "refused";
}

export interface ConsentTypeStats {
  type: ConsentType;
  granted: number;
  refused: number;
  pending: number;
  withdrawn: number;
  rate?: number;
}

export interface ClassConsentSummary {
  total_students: number;
  consent_types: ConsentTypeStats[];
}

export interface ComplianceOverview {
  total_students: number;
  consent_types: ConsentTypeStats[];
}

export interface ConsentAuditLog {
  log_id: number;
  consent_id: number;
  action: string;
  performed_by: number | null;
  previous_status: string | null;
  new_status: string | null;
  timestamp: string | null;
  ip_address: string | null;
  notes: string | null;
}

/** Student: fetch own consent records (creates pending rows on first call) */
export async function consentGetMy(): Promise<ConsentRecord[]> {
  const { data } = await api.get<ConsentRecord[]>("/consent/my");
  return data;
}

/** Student / Parent: batch-save consent choices */
export async function consentSave(
  consents: ConsentChoiceItem[],
  studentId?: number,
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/consent/save", {
    student_id: studentId ?? null,
    consents,
  });
  return data;
}

/** Student / Parent: withdraw a single consent type */
export async function consentWithdraw(
  consentType: ConsentType,
  studentId?: number,
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/consent/withdraw", {
    consent_type: consentType,
    student_id: studentId ?? null,
  });
  return data;
}

/** Admin: institution-wide compliance overview */
export async function consentGetComplianceOverview(): Promise<ComplianceOverview> {
  const { data } = await api.get<ComplianceOverview>("/consent/compliance/overview");
  return data;
}

/** Admin: initialise pending consent records for all students */
export async function consentBulkRequest(): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/consent/bulk-request");
  return data;
}

/** Teacher/Admin: class consent summary */
export async function consentGetClassSummary(classId: number): Promise<ClassConsentSummary> {
  const { data } = await api.get<ClassConsentSummary>(`/consent/class/${classId}`);
  return data;
}

/** Admin/Teacher: full audit log for a student */
export async function consentGetAuditLog(studentId: number): Promise<ConsentAuditLog[]> {
  const { data } = await api.get<ConsentAuditLog[]>(`/consent/audit/${studentId}`);
  return data;
}

/** Admin/Teacher: view a student's consent records */
export async function consentGetStudentRecords(studentId: number): Promise<ConsentRecord[]> {
  const { data } = await api.get<ConsentRecord[]>(`/consent/${studentId}`);
  return data;
}

/** Parent: fetch consent records for a child (uses parent-scoped endpoint) */
export async function consentGetChildRecords(studentUserId: number): Promise<ConsentRecord[]> {
  const { data } = await api.get<ConsentRecord[]>(`/consent/child/${studentUserId}`);
  return data;
}
