import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "student" | "teacher" | "parent" | "admin";
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar role={role} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <motion.div
        animate={{
          marginLeft: sidebarCollapsed ? "80px" : "280px",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="transition-all duration-300"
      >
        <Header role={role} />
        <main className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
}
