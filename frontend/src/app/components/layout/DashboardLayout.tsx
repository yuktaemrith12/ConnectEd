// Shared shell for all role dashboards (admin, teacher, student, parent).
// Renders the Sidebar, Header, and animated page content area.
// For student pages it also renders the ConsentGateway overlay unless
// skipConsent is explicitly set to true (e.g. on the live class room).

import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import ConsentGateway from "@/app/components/ConsentGateway";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "student" | "teacher" | "parent" | "admin";
  /** Pass true on pages where the consent overlay would block critical UI (e.g. live class room) */
  skipConsent?: boolean;
}

export default function DashboardLayout({ children, role, skipConsent = false }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {role === "student" && !skipConsent && <ConsentGateway />}
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
