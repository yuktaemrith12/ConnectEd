import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import StatCard from "@/app/components/shared/StatCard";
import {
  CheckCircle2, BarChart3, Calendar, DollarSign,
  ChevronRight, Loader2, AlertCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useParams, Link } from "react-router";
import {
  getParentChildAttendance, StudentAttendanceSummary,
  parentGetChildFees, ParentFeeStatus,
  parentGetChildEvents, ParentEventItem,
  parentGetChildGrades, ParentGradesSummary,
} from "@/app/utils/api";

function renderWidgetError(message = "Failed to load data") {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
      <AlertCircle size={18} className="shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function ParentDashboard() {
  const params = useParams();
  const currentChildId = params.childId ? parseInt(params.childId) : null;

  // Attendance
  const [attendance, setAttendance]       = useState<StudentAttendanceSummary | null>(null);
  const [attLoading, setAttLoading]       = useState(false);
  const [attError, setAttError]           = useState(false);

  // Fees
  const [fees, setFees]                   = useState<ParentFeeStatus | null>(null);
  const [feesLoading, setFeesLoading]     = useState(false);
  const [feesError, setFeesError]         = useState(false);

  // Events
  const [events, setEvents]               = useState<ParentEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError]     = useState(false);

  // Grades
  const [grades, setGrades]               = useState<ParentGradesSummary | null>(null);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError]     = useState(false);

  useEffect(() => {
    if (!currentChildId) return;

    setAttLoading(true);
    setAttError(false);
    getParentChildAttendance(currentChildId)
      .then(setAttendance)
      .catch(() => setAttError(true))
      .finally(() => setAttLoading(false));

    setFeesLoading(true);
    setFeesError(false);
    parentGetChildFees(currentChildId)
      .then(setFees)
      .catch(() => setFeesError(true))
      .finally(() => setFeesLoading(false));

    setEventsLoading(true);
    setEventsError(false);
    parentGetChildEvents(currentChildId)
      .then(setEvents)
      .catch(() => setEventsError(true))
      .finally(() => setEventsLoading(false));

    setGradesLoading(true);
    setGradesError(false);
    parentGetChildGrades(currentChildId)
      .then(setGrades)
      .catch(() => setGradesError(true))
      .finally(() => setGradesLoading(false));
  }, [currentChildId]);

  const attendanceRate = attendance?.attendance_rate ?? null;
  const totalSessions  = attendance?.total_sessions ?? 0;
  const presentCount   = attendance?.present_count ?? 0;

  const feeStatusLabel = fees
    ? fees.status === "paid"    ? "Paid"
    : fees.status === "partial" ? "Partial"
    : fees.status === "overdue" ? "Overdue"
    : fees.status === "unpaid"  ? "Unpaid"
    : "—"
    : "—";

  // Only show future events in the dashboard widget
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events.filter(e => new Date(e.start_date) >= today);

  // Real grades only — no fallback fake data
  const gradeItems = grades?.items ?? [];
  const overallGrade = grades?.overall_grade ?? "—";

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Parent Dashboard</h1>
          <p className="text-gray-600">Monitor your child's progress</p>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <StatCard
              title="Attendance Rate"
              value={attLoading ? "…" : attendanceRate !== null ? `${attendanceRate}%` : "—"}
              icon={CheckCircle2}
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <StatCard
              title="Overall Grade"
              value={gradesLoading ? "…" : overallGrade}
              icon={BarChart3}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <StatCard
              title="Fee Status"
              value={feesLoading ? "…" : feeStatusLabel}
              icon={DollarSign}
              gradient={fees?.is_overdue
                ? "bg-gradient-to-br from-red-500 to-red-600"
                : "bg-gradient-to-br from-green-500 to-green-600"}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <StatCard
              title="Upcoming Events"
              value={eventsLoading ? "…" : String(upcomingEvents.length)}
              icon={Calendar}
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
          </motion.div>
        </div>

        {/* Attendance & Grades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full" />
              Attendance Summary
            </h3>

            {attLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-green-500" size={28} />
              </div>
            ) : attError ? (
              renderWidgetError("Could not load attendance data.")
            ) : attendance ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {presentCount}/{totalSessions} sessions
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${attendanceRate ?? 0}%` }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full shadow-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{attendanceRate}% attendance rate</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {([
                    { label: "Present", value: attendance.present_count, color: "text-green-600 bg-green-50" },
                    { label: "Absent",  value: attendance.absent_count,  color: "text-red-600 bg-red-50" },
                    { label: "Late",    value: attendance.late_count,    color: "text-amber-600 bg-amber-50" },
                  ] as { label: string; value: number; color: string }[]).map((item) => (
                    <div key={item.label} className={`rounded-xl p-3 text-center ${item.color}`}>
                      <p className="text-xl font-bold">{item.value}</p>
                      <p className="text-xs font-medium">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                <CheckCircle2 size={36} className="mb-2 opacity-30" />
                <p className="text-sm">No attendance data available.</p>
              </div>
            )}
          </motion.div>

          {/* Recent Grades */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full" />
              Recent Grades
            </h3>
            {gradesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-blue-500" size={28} />
              </div>
            ) : gradesError ? (
              renderWidgetError("Could not load grades data.")
            ) : gradeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                <BarChart3 size={36} className="mb-2 opacity-30" />
                <p className="text-sm">No graded assessments yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gradeItems.slice(0, 4).map((item, index) => {
                  const color = item.percentage >= 80 ? "green" : item.percentage >= 60 ? "blue" : "red";
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className={`p-4 bg-gradient-to-r ${
                        color === "green" ? "from-green-50 to-transparent"
                        : color === "blue" ? "from-blue-50 to-transparent"
                        : "from-red-50 to-transparent"
                      } rounded-xl border-l-4 ${
                        color === "green" ? "border-green-500"
                        : color === "blue" ? "border-blue-500"
                        : "border-red-500"
                      } hover:shadow-sm transition-shadow`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{item.subject}</p>
                          <p className="text-xs text-gray-500">{item.assessment}</p>
                        </div>
                        <span className={`text-lg font-bold ${
                          color === "green" ? "text-green-600"
                          : color === "blue" ? "text-blue-600"
                          : "text-red-600"
                        }`}>{item.grade}</span>
                      </div>
                      <p className="text-xs text-gray-400">{item.date}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Fee Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full" />
            Fee Summary
          </h3>

          {feesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-green-500" size={28} />
            </div>
          ) : feesError ? (
            renderWidgetError("Could not load fee data.")
          ) : fees && fees.has_plan ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                  fees.status === "paid"    ? "bg-green-100 text-green-700"
                  : fees.status === "partial" ? "bg-amber-100 text-amber-700"
                  : fees.status === "overdue" ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
                }`}>
                  {feeStatusLabel}
                </span>
                {fees.academic_period && (
                  <p className="text-xs text-gray-400 mt-2">{fees.academic_period}</p>
                )}
              </div>
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Total Fee</p>
                <p className="text-2xl font-bold text-gray-800">Rs {fees.total_fee.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Paid: Rs {fees.amount_paid.toLocaleString()}</p>
              </div>
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Outstanding Balance</p>
                <p className={`text-2xl font-bold ${fees.outstanding_balance > 0 ? "text-red-600" : "text-green-600"}`}>
                  Rs {fees.outstanding_balance.toLocaleString()}
                </p>
                {fees.due_date && (
                  <p className={`text-xs mt-1 ${fees.is_overdue ? "text-red-500" : "text-gray-500"}`}>
                    Due: {fees.due_date}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">No fee plan assigned yet. Contact the school administration.</p>
          )}
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" />
              Upcoming Events
            </h3>
            <Link
              to={`/parent/${currentChildId}/events`}
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
            >
              View Full Calendar
              <ChevronRight size={16} />
            </Link>
          </div>

          {eventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-purple-500" size={28} />
            </div>
          ) : eventsError ? (
            renderWidgetError("Could not load events data.")
          ) : upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.slice(0, 6).map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + index * 0.05 }}
                  whileHover={{ x: 4, scale: 1.02 }}
                  className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-800 text-sm leading-tight">{event.title}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-2 ${
                      event.type === "Exam"     ? "bg-orange-100 text-orange-600"
                      : event.type === "Meeting" ? "bg-purple-100 text-purple-600"
                      : event.type === "Holiday" ? "bg-green-100 text-green-600"
                      : "bg-blue-100 text-blue-600"
                    }`}>{event.type}</span>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <Calendar size={13} />{event.start_date}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar size={40} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No upcoming events at this time.</p>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
