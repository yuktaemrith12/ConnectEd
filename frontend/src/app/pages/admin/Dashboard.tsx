import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import StatCard from "@/app/components/shared/StatCard";
import { Users, GraduationCap, ClipboardCheck, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { adminGetDashboard, type DashboardData } from "@/app/utils/api";

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetDashboard()
      .then(setData)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const fmtRs = (n: number) => `Rs ${n.toLocaleString()}`;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back, manage your school operations</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Students"
            value={loading ? "—" : String(data?.total_students ?? 0)}
            icon={GraduationCap}
            trend=""
            trendUp={true}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            title="Total Teachers"
            value={loading ? "—" : String(data?.total_teachers ?? 0)}
            icon={Users}
            trend=""
            trendUp={true}
            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            title="Attendance Rate"
            value={loading ? "—" : `${data?.attendance_rate ?? 0}%`}
            icon={ClipboardCheck}
            trend=""
            trendUp={true}
            gradient="bg-gradient-to-br from-green-500 to-green-600"
          />
          <StatCard
            title="Unpaid Fees"
            value={loading ? "—" : fmtRs(data?.unpaid_fees ?? 0)}
            icon={DollarSign}
            trend=""
            trendUp={false}
            gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Attendance Trend</h3>
              <TrendingUp size={20} className="text-green-500" />
            </div>
            {(!data || data.attendance_trend.length === 0) ? (
              <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">No attendance data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.attendance_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" domain={[50, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Attendance Rate"]} />
                  <Line type="monotone" dataKey="rate" stroke="#f97316" strokeWidth={3} dot={{ fill: "#f97316", r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Fee Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-6">Fee Status</h3>
            {(!data || data.fee_status.every(d => d.value === 0)) ? (
              <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">No fee data yet</div>
            ) : (
              <div className="flex items-center justify-between">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.fee_status}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.fee_status.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {data.fee_status.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.value} students</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Enrolment Trend & Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enrolment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-6">Enrolment by Grade</h3>
            {(!data || data.enrolment_data.length === 0) ? (
              <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">No class data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.enrolment_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="grade" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip />
                  <Bar dataKey="students" fill="#f97316" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Upcoming Events */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Upcoming Events</h3>
              <Calendar size={20} className="text-orange-500" />
            </div>
            <div className="space-y-4">
              {(!data || data.upcoming_events.length === 0) ? (
                <p className="text-sm text-gray-400 text-center py-8">No upcoming events</p>
              ) : (
                data.upcoming_events.map((event, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ x: 4 }}
                    className="p-4 bg-gradient-to-r from-orange-50 to-transparent rounded-xl border-l-4 border-orange-500"
                  >
                    <p className="font-medium text-sm mb-1">{event.title}</p>
                    <p className="text-xs text-gray-500 mb-2">{event.date}</p>
                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                      {event.type}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
