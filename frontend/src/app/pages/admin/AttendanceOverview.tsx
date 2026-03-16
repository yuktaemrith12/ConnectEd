import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, UserCheck, UserX, AlertTriangle, Download, Calendar,
  Search, Filter, Eye, User, X, TrendingUp, TrendingDown, Clock,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  adminGetAttendanceStats, adminGetAttendanceTrend, adminGetAttendanceDistribution,
  adminGetClasswiseAttendance, adminGetAttendanceRecords, adminGetClasses,
  type AttendanceStats, type AttendanceTrendPoint, type AttendanceDistribution,
  type ClasswiseAttendance, type AttendanceRecordRead, type AdminClass,
} from "@/app/utils/api";

type AttendanceStatus = "Present" | "Absent" | "Late";

const statusConfig: Record<AttendanceStatus, { label: string; color: string; bgColor: string }> = {
  Present: { label: "Present", color: "text-green-700", bgColor: "bg-green-100" },
  Absent: { label: "Absent", color: "text-red-700", bgColor: "bg-red-100" },
  Late: { label: "Late", color: "text-amber-700", bgColor: "bg-amber-100" },
};

export default function AdminAttendanceOverview() {
  const [dateRange, setDateRange] = useState("This Week");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<AttendanceRecordRead | null>(null);

  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [trend, setTrend] = useState<AttendanceTrendPoint[]>([]);
  const [distribution, setDistribution] = useState<AttendanceDistribution | null>(null);
  const [classwise, setClasswise] = useState<ClasswiseAttendance[]>([]);
  const [records, setRecords] = useState<AttendanceRecordRead[]>([]);
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, d, cw] = await Promise.all([
        adminGetAttendanceStats(dateRange),
        adminGetAttendanceTrend(dateRange),
        adminGetAttendanceDistribution(dateRange),
        adminGetClasswiseAttendance(dateRange),
      ]);
      setStats(s);
      setTrend(t);
      setDistribution(d);
      setClasswise(cw);
    } catch {
      setError("Failed to load attendance analytics.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const loadRecords = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterClass !== "all") params.class_id = parseInt(filterClass);
      if (filterStatus !== "all") params.status = filterStatus;
      const data = await adminGetAttendanceRecords(params as Parameters<typeof adminGetAttendanceRecords>[0]);
      setRecords(data);
    } catch {
      setRecords([]);
    }
  }, [searchQuery, filterClass, filterStatus]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { adminGetClasses().then(setClasses).catch(() => { }); }, []);

  const pieData = distribution
    ? [
      { name: "Present", value: distribution.present, color: "#10b981" },
      { name: "Absent", value: distribution.absent, color: "#ef4444" },
      { name: "Late", value: distribution.late, color: "#f59e0b" },
    ]
    : [];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Attendance Overview</h1>
            <p className="text-gray-600">Monitor student and staff attendance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer font-medium">
                <option>Today</option>
                <option>This Week</option>
                <option>This Month</option>
                <option>This Term</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-orange-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl"><Users className="text-orange-600" size={24} /></div>
              {stats && (
                <div className={`flex items-center gap-1 text-sm ${stats.trend_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {stats.trend_pct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span>{stats.trend_pct >= 0 ? "+" : ""}{stats.trend_pct}%</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Overall Attendance Rate</p>
              <p className="text-3xl font-bold">{loading ? "—" : `${stats?.overall_rate ?? 0}%`}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-green-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl"><UserCheck className="text-green-600" size={24} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Students Present Today</p>
              <p className="text-3xl font-bold">
                {loading ? "—" : stats?.present_today ?? 0}{" "}
                <span className="text-lg text-gray-500">/ {stats?.total_students ?? 0}</span>
              </p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-red-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-xl"><UserX className="text-red-600" size={24} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Students Absent Today</p>
              <p className="text-3xl font-bold">{loading ? "—" : stats?.absent_today ?? 0}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-amber-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-xl"><AlertTriangle className="text-amber-600" size={24} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Chronic Absentees</p>
              <p className="text-3xl font-bold">{loading ? "—" : "—"}</p>
              <p className="text-xs text-gray-500">Below 80% attendance</p>
            </div>
          </motion.div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold mb-6">Attendance Trend Over Time</h3>
            {trend.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} domain={[50, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(v: number) => [`${v}%`, "Attendance Rate"]} />
                  <Line type="monotone" dataKey="rate" stroke="#f97316" strokeWidth={3}
                    dot={{ fill: "#f97316", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold mb-6">Attendance by Class</h3>
            {classwise.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No class data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={classwise}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="class_name" stroke="#9ca3af" style={{ fontSize: "11px" }} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} domain={[50, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(v: number) => [`${v}%`, "Attendance Rate"]} />
                  <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                    {classwise.map((entry, index) => (
                      <Cell key={`cell-${index}`}
                        fill={entry.rate >= 95 ? "#10b981" : entry.rate >= 90 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Distribution pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6">Attendance Distribution</h3>
          {pieData.every(d => d.value === 0) ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No attendance data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle"
                  formatter={(value, entry: any) => (
                    <span className="text-sm text-gray-700">{value}: <strong>{entry.payload.value}</strong></span>
                  )} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Records Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold mb-4">Attendance Records</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Search by name or student ID..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
                    className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer">
                    <option value="all">All Classes</option>
                    {classes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer">
                  <option value="all">All Status</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {records.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                {loading ? "Loading…" : "No attendance records found. Mark attendance to see data here."}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Class</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Marked By</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record) => {
                    const st = (record.status as AttendanceStatus) in statusConfig
                      ? (record.status as AttendanceStatus) : "Present";
                    return (
                      <motion.tr key={record.id} whileHover={{ backgroundColor: "#f9fafb" }} className="transition-colors">
                        <td className="px-6 py-4"><div className="font-medium text-gray-900">{record.student_name}</div></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{record.student_code}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{record.class_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(record.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <motion.span
                              animate={st === "Absent" ? { opacity: [1, 0.7, 1] } : {}}
                              transition={st === "Absent" ? { duration: 2, repeat: Infinity } : {}}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusConfig[st].bgColor} ${statusConfig[st].color}`}>
                              {st === "Late" && <Clock size={12} />}
                              {statusConfig[st].label}
                            </motion.span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{record.marked_by}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedStudent(record)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View History">
                              <Eye size={16} className="text-gray-600" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              className="p-2 hover:bg-orange-50 rounded-lg transition-colors" title="View Profile">
                              <User size={16} className="text-orange-600" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      {/* Student History Slide-over */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end z-50"
            onClick={() => setSelectedStudent(null)}>
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white h-full w-full max-w-lg shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedStudent.student_name}</h2>
                  <p className="text-sm text-gray-600">{selectedStudent.student_code} • {selectedStudent.class_name}</p>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={24} />
                </motion.button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 text-center">
                  <p className="text-sm text-orange-800 mb-2 font-medium">Overall Attendance Rate</p>
                  <p className="text-5xl font-bold text-orange-600 mb-1">{selectedStudent.attendance_rate}%</p>
                  <p className="text-xs text-orange-700">
                    {selectedStudent.attendance_rate >= 95 ? "Excellent attendance"
                      : selectedStudent.attendance_rate >= 85 ? "Good attendance"
                        : selectedStudent.attendance_rate >= 75 ? "Needs improvement"
                          : "Critical - requires attention"}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4">Recent Attendance</h3>
                  {selectedStudent.history.length === 0 ? (
                    <p className="text-sm text-gray-500">No history available.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedStudent.history.map((day, index) => {
                        const s = (day.status as AttendanceStatus) in statusConfig
                          ? (day.status as AttendanceStatus) : "Present";
                        return (
                          <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 ${s === "Present" ? "border-green-200 bg-green-50"
                                : s === "Absent" ? "border-red-200 bg-red-50"
                                  : "border-amber-200 bg-amber-50"}`}>
                            <div>
                              <p className="font-medium text-gray-900">
                                {new Date(day.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                              </p>
                              <p className="text-xs text-gray-600">{new Date(day.date).getFullYear()}</p>
                            </div>
                            <span className={`px-4 py-2 rounded-lg font-semibold ${statusConfig[s].bgColor} ${statusConfig[s].color}`}>
                              {statusConfig[s].label}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedStudent.attendance_rate < 80 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-semibold text-amber-900 mb-1">Chronic Absenteeism Alert</p>
                      <p className="text-sm text-amber-800">
                        This student has an attendance rate below 80%. Consider reaching out to parents.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 space-y-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                  <Download size={18} />
                  Export Attendance Report
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStudent(null)}
                  className="w-full px-4 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
