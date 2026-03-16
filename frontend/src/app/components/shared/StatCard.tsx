import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  gradient?: string;
}

export default function StatCard({ title, value, icon: Icon, trend, trendUp, gradient }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl ${gradient || "bg-gray-100"} flex items-center justify-center`}
        >
          <Icon size={24} className="text-white" />
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold mb-1">{value}</h3>
      <p className="text-sm text-gray-600">{title}</p>
    </motion.div>
  );
}
