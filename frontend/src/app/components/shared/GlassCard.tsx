import { ReactNode } from "react";
import { motion } from "motion/react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
}

export default function GlassCard({ children, className = "", gradient }: GlassCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-white/80 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6 transition-all ${className}`}
      style={gradient ? { background: gradient } : {}}
    >
      {children}
    </motion.div>
  );
}
