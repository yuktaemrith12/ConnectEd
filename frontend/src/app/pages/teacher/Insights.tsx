import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Brain, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";
import { motion } from "motion/react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const submissionData = [
  { week: "Week 1", onTime: 85, late: 15 },
  { week: "Week 2", onTime: 78, late: 22 },
  { week: "Week 3", onTime: 92, late: 8 },
  { week: "Week 4", onTime: 88, late: 12 },
];

const topicPerformance = [
  { topic: "Algebra", score: 85, color: "#10b981" },
  { topic: "Geometry", score: 72, color: "#f59e0b" },
  { topic: "Fractions", score: 68, color: "#ef4444" },
  { topic: "Statistics", score: 90, color: "#10b981" },
  { topic: "Trigonometry", score: 65, color: "#ef4444" },
];

const engagementData = [
  { lesson: "L1", engagement: 88 },
  { lesson: "L2", engagement: 75 },
  { lesson: "L3", engagement: 92 },
  { lesson: "L4", engagement: 68 },
  { lesson: "L5", engagement: 85 },
];

const insights = [
  {
    icon: TrendingDown,
    color: "red",
    title: "Low Engagement Detected",
    description: "Lesson 4 (Quadratic Equations) showed 32% lower engagement than average",
    action: "Consider adding interactive elements or real-world examples",
  },
  {
    icon: AlertTriangle,
    color: "orange",
    title: "Struggling Topic",
    description: "65% of students scored below 70% in Trigonometry assessments",
    action: "Recommend scheduling a review session or additional practice materials",
  },
  {
    icon: Lightbulb,
    color: "green",
    title: "High Performance",
    description: "Statistics module achieved 90% average - highest this semester",
    action: "Great job! Consider using similar teaching methods for other topics",
  },
];

export default function TeacherInsights() {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Brain size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Insights</h1>
            <p className="text-gray-600">Class engagement and performance analytics</p>
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 flex items-start gap-3">
          <Brain className="text-blue-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">About AI Insights</h3>
            <p className="text-sm text-blue-800">
              Insights are based on historical academic data and are intended to support teaching decisions. This page provides analytics only - no AI-generated content or feedback.
            </p>
          </div>
        </div>

        {/* Insight Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    insight.color === "red"
                      ? "bg-red-100"
                      : insight.color === "orange"
                      ? "bg-orange-100"
                      : "bg-green-100"
                  }`}
                >
                  <Icon
                    size={24}
                    className={
                      insight.color === "red"
                        ? "text-red-600"
                        : insight.color === "orange"
                        ? "text-orange-600"
                        : "text-green-600"
                    }
                  />
                </div>
                <h3 className="font-semibold mb-2">{insight.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <p className="text-xs font-medium text-purple-900">Recommendation:</p>
                  <p className="text-xs text-purple-700 mt-1">{insight.action}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submission Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">On-Time Submission Rate</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={submissionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Bar dataKey="onTime" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="late" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full" />
                <span className="text-sm text-gray-600">On Time</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-sm text-gray-600">Late</span>
              </div>
            </div>
          </motion.div>

          {/* Topic Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Grade Distribution by Topic</h3>
            <div className="space-y-4">
              {topicPerformance.map((topic, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{topic.topic}</span>
                    <span className="text-sm text-gray-600">{topic.score}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${topic.score}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: topic.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Engagement Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
        >
          <h3 className="text-lg font-semibold mb-4">Lesson Engagement Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="lesson" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip />
              <Line type="monotone" dataKey="engagement" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: "#8b5cf6", r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}