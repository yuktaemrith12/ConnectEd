import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ShieldAlert, ArrowLeft, LogIn } from "lucide-react";
import { isAuthenticated, getStoredRole } from "@/app/utils/api";

const roleDashboard: Record<string, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

export default function Unauthorized() {
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const role = getStoredRole();
  const dashboard = role ? roleDashboard[role] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 flex flex-col items-center text-center gap-6"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
          className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center"
        >
          <ShieldAlert className="w-10 h-10 text-red-500" strokeWidth={1.5} />
        </motion.div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            You don't have permission to view this page.
            {role && (
              <>
                {" "}Your account has the <span className="font-semibold text-slate-700">{role}</span> role, which does not include access to this section.
              </>
            )}
          </p>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-slate-100" />

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full">
          {authenticated && dashboard ? (
            <button
              onClick={() => navigate(dashboard)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to my dashboard
            </button>
          ) : null}

          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Back to login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
