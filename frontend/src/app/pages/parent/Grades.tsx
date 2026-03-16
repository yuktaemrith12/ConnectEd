import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion } from "motion/react";
import { useParams } from "react-router";
import {
  Award,
  BookOpen,
  BarChart3,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parentGetChildGrades, ParentGradesSummary, ParentGradeItem } from "@/app/utils/api";

// Group grade items by subject and compute per-subject averages
function buildSubjectPerformance(items: ParentGradeItem[]) {
  const map = new Map<string, number[]>();
  items.forEach(item => {
    if (!map.has(item.subject)) map.set(item.subject, []);
    map.get(item.subject)!.push(item.percentage);
  });
  return Array.from(map.entries()).map(([subject, pcts]) => {
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    return { subject, percentage: avg, color: avg >= 80 ? "green" : avg >= 60 ? "blue" : "red" };
  });
}

export default function ParentGrades() {
  const { childId } = useParams<{ childId: string }>();
  const [grades, setGrades] = useState<ParentGradesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!childId || childId === "0") { setLoading(false); return; }
    parentGetChildGrades(Number(childId))
      .then(setGrades)
      .catch(() => setError("Failed to load grades."))
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) return (
    <DashboardLayout role="parent">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    </DashboardLayout>
  );

  if (!childId || childId === "0") return (
    <DashboardLayout role="parent">
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No child selected.</p>
      </div>
    </DashboardLayout>
  );

  const items = grades?.items ?? [];
  const subjectPerformance = buildSubjectPerformance(items);
  const chartData = subjectPerformance.map(s => ({
    subject: s.subject.length > 10 ? s.subject.slice(0, 9) + "…" : s.subject,
    score: s.percentage,
  }));

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Grades & Progress</h1>
          <p className="text-gray-600 mb-3">Track your child's academic performance</p>
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <Info size={16} className="text-blue-600" />
            <span className="text-sm text-blue-700">
              Grades are updated by teachers after assessments are reviewed.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Section 1: Overall Academic Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <Award size={24} className="text-white" />
              </div>
            </div>
            <div className="text-4xl font-bold text-gray-800 mb-1">
              {grades?.overall_grade ?? "—"}
            </div>
            <p className="text-sm text-gray-600 font-medium">Overall Average</p>
            <p className="text-xs text-gray-400 mt-2">Across published assessments</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <BarChart3 size={24} className="text-white" />
              </div>
            </div>
            <div className="text-4xl font-bold text-gray-800 mb-1">{items.length}</div>
            <p className="text-sm text-gray-600 font-medium">Assessments Graded</p>
            <p className="text-xs text-gray-400 mt-2">Published results</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <BookOpen size={24} className="text-white" />
              </div>
            </div>
            <div className="text-4xl font-bold text-gray-800 mb-1">{subjectPerformance.length}</div>
            <p className="text-sm text-gray-600 font-medium">Subjects</p>
            <p className="text-xs text-gray-400 mt-2">With graded work</p>
          </motion.div>
        </div>

        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center"
          >
            <Award size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">No graded assessments yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Grades will appear here once teachers publish results.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Section 2: Subject-Wise Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full" />
                Subject Performance
              </h3>
              <div className="space-y-5">
                {subjectPerformance.map((subject, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">{subject.subject}</span>
                      <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                        subject.color === "green"
                          ? "bg-green-100 text-green-700"
                          : subject.color === "blue"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {subject.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${subject.percentage}%` }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                        className={`h-3 rounded-full ${
                          subject.color === "green"
                            ? "bg-gradient-to-r from-green-500 to-green-600"
                            : subject.color === "blue"
                            ? "bg-gradient-to-r from-blue-400 to-blue-500"
                            : "bg-gradient-to-r from-red-400 to-red-500"
                        }`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Section 3 & 4: Recent Grades and Subject Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Grades */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full" />
                  Recent Grades
                </h3>
                <div className="space-y-3">
                  {items.slice(0, 5).map((item, index) => {
                    const color = item.percentage >= 80 ? "green" : item.percentage >= 60 ? "blue" : "red";
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        className={`p-4 bg-gradient-to-r ${
                          color === "green" ? "from-green-50 to-transparent" :
                          color === "blue" ? "from-blue-50 to-transparent" : "from-red-50 to-transparent"
                        } rounded-xl border-l-4 ${
                          color === "green" ? "border-green-500" :
                          color === "blue" ? "border-blue-500" : "border-red-500"
                        } hover:shadow-sm transition-shadow`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-800">{item.assessment}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.subject}</p>
                          </div>
                          <span className={`text-lg font-bold ml-3 ${
                            color === "green" ? "text-green-600" :
                            color === "blue" ? "text-blue-600" : "text-red-600"
                          }`}>
                            {item.grade}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{item.date}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Subject Score Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" />
                  Score by Subject
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [`${value}%`, "Avg Score"]}
                      />
                      <Bar dataKey="score" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
