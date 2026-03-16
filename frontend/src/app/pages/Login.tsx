import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { loginRequest, saveSession } from "@/app/utils/api";
import ForgotModal from "@/app/components/auth/ForgotModal";

// Images are now in /public/images/ folder
// Access them directly without import statements
const studentImg = "public/images/student-illustration.png";
const teacherImg = "/images/teacher-illustration.png";
const parentImg = "/images/parent-illustration.png";
const adminImg = "/images/admin-illustration.png";
const logo = "/images/logo.png";

type Role = "student" | "teacher" | "parent" | "admin";

const roleConfig = {
  student: {
    title: "Student Portal",
    subtitle: "Let's get you ready for today's classes",
    description: "Where homework meets hope, and deadlines become... guidelines?",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
    color: "#3b82f6",
    image: studentImg,
    path: "/student",
  },
  teacher: {
    title: "Teacher Portal",
    subtitle: "Manage your classes and students efficiently",
    description: "Coffee-powered, grade-ready, and only slightly caffeinated",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
    color: "#8b5cf6",
    image: teacherImg,
    path: "/teacher",
  },
  parent: {
    title: "Parent Portal",
    subtitle: "Stay connected with your child's progress",
    description: "Because 'How was school?' deserves a better answer",
    gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
    color: "#10b981",
    image: parentImg,
    path: "/parent",
  },
  admin: {
    title: "Admin Portal",
    subtitle: "Oversee school operations and analytics",
    description: "The one dashboard to rule them all. You're in charge now",
    gradient: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
    color: "#f97316",
    image: adminImg,
    path: "/admin",
  },
};

function roleFromPath(path: string): Role | null {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/teacher")) return "teacher";
  if (path.startsWith("/parent")) return "parent";
  if (path.startsWith("/student")) return "student";
  return null;
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const fromPath = searchParams.get("from");

  const [selectedRole, setSelectedRole] = useState<Role>(() => {
    // Auto-select role tab when arriving from a WhatsApp / deep link
    if (fromPath) return roleFromPath(fromPath) ?? "student";
    return "student";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const navigate = useNavigate();

  // Keep role tab in sync if the ?from= param changes (e.g. back/forward nav)
  useEffect(() => {
    if (fromPath) {
      const detected = roleFromPath(fromPath);
      if (detected) setSelectedRole(detected);
    }
  }, [fromPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      const data = await loginRequest(email, password);

      // Verify the returned role matches the selected portal
      if (data.user.role !== selectedRole) {
        setError(
          `Access Denied. Please log in with the appropriate role. Your role is: ${data.user.role}`
        );
        setIsLoading(false);
        return;
      }

      saveSession(data);

      // Redirect to the originally requested page (e.g. from a WhatsApp link),
      // falling back to the default role dashboard.
      const destination =
        fromPath && roleFromPath(fromPath) === data.user.role
          ? fromPath
          : roleConfig[selectedRole].path;
      navigate(destination);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError("Invalid email or password. Please try again.");
      } else if (status === 403) {
        setError("Your account is inactive. Please contact your administrator.");
      } else {
        setError("Unable to connect to the server. Please try again later.");
      }
      setIsLoading(false);
    }
  };

  const getRoleIndex = (role: Role) => {
    return ["student", "teacher", "parent", "admin"].indexOf(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 md:p-6">
      <ForgotModal isOpen={isForgotModalOpen} onClose={() => setIsForgotModalOpen(false)} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-6xl bg-white/95 backdrop-blur-sm rounded-3xl shadow-[0px_20px_40px_rgba(0,0,0,0.08)] overflow-hidden grid md:grid-cols-2"
      >
        {/* Left Panel - Login Form */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="p-8 md:p-12 flex flex-col"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img src={logo} alt="ConnectEd Logo" className="w-12 h-12 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight">ConnectEd</h1>
          </div>

          {/* Role Selector */}
          <div className="relative bg-gray-100 rounded-full p-1.5 mb-8">
            <div className="grid grid-cols-4 relative z-10">
              {(["student", "teacher", "parent", "admin"] as Role[]).map((role) => (
                <motion.button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  whileHover={{ scale: selectedRole !== role ? 1.05 : 1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`py-2.5 px-3 text-xs md:text-sm font-semibold rounded-full transition-colors capitalize relative z-10 ${
                    selectedRole === role ? "text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                  style={{
                    color: selectedRole === role ? "white" : undefined,
                  }}
                >
                  {role}
                </motion.button>
              ))}
            </div>
            <motion.div
              layoutId="activeRoleTab"
              className="absolute top-1.5 bottom-1.5 rounded-full shadow-md"
              style={{
                left: `${getRoleIndex(selectedRole) * 25 + 0.375}%`,
                width: "calc(25% - 0.75%)",
                background: roleConfig[selectedRole].gradient,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.25 }}
            />
          </div>

          {/* Welcome Text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedRole}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-6"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-2">Welcome back</h2>
              <p className="text-gray-600">{roleConfig[selectedRole].subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5 mb-6 flex-1">
            {/* Email Field */}
            <div>
              <motion.label
                animate={{ y: emailFocused ? -2 : 0 }}
                transition={{ duration: 0.15 }}
                htmlFor="email"
                className="text-sm font-semibold text-gray-700 mb-2 block"
              >
                Email
              </motion.label>
              <motion.div
                animate={{
                  scale: emailFocused ? 1.01 : 1,
                }}
                transition={{ duration: 0.15 }}
              >
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-150 focus:outline-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: emailFocused ? roleConfig[selectedRole].color : "#e5e7eb",
                  }}
                />
              </motion.div>
            </div>

            {/* Password Field */}
            <div>
              <motion.label
                animate={{ y: passwordFocused ? -2 : 0 }}
                transition={{ duration: 0.15 }}
                htmlFor="password"
                className="text-sm font-semibold text-gray-700 mb-2 block"
              >
                Password
              </motion.label>
              <motion.div
                animate={{
                  scale: passwordFocused ? 1.01 : 1,
                }}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 pr-12 border-2 rounded-xl transition-all duration-150 focus:outline-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: passwordFocused ? roleConfig[selectedRole].color : "#e5e7eb",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff size={18} className="text-gray-500" />
                  ) : (
                    <Eye size={18} className="text-gray-500" />
                  )}
                </button>
              </motion.div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
                >
                  <AlertCircle size={16} />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={!isLoading ? { y: -2, boxShadow: `0 8px 16px ${roleConfig[selectedRole].color}40` } : {}}
              whileTap={!isLoading ? { scale: 0.98 } : {}}
              className="w-full py-3.5 rounded-xl text-white font-semibold shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: roleConfig[selectedRole].gradient,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing you in...
                </>
              ) : (
                "Login"
              )}
            </motion.button>

            {/* Forgot Password */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isLoading}
                onClick={() => setIsForgotModalOpen(true)}
              >
                Forgot password?
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-auto pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              © 2026 ConnectEd. All rights reserved.
            </p>
          </div>
        </motion.div>

        {/* Right Panel - Illustration */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedRole}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative p-12 flex flex-col items-center justify-center overflow-hidden"
            style={{ background: roleConfig[selectedRole].gradient }}
          >
            {/* Decorative Circles */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -top-20 -right-20 w-80 h-80 bg-white rounded-full"
              />
              <motion.div
                animate={{
                  scale: [1.2, 1, 1.2],
                  opacity: [0.1, 0.15, 0.1],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-32 -left-32 w-96 h-96 bg-white rounded-full"
              />
            </div>

            {/* Role Title Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative bg-white/20 backdrop-blur-md rounded-2xl p-6 mb-8 max-w-sm border border-white/30"
            >
              <h3 className="font-bold text-2xl text-white mb-3">
                {roleConfig[selectedRole].title}
              </h3>
              <p className="text-base font-medium text-white leading-relaxed">
                {roleConfig[selectedRole].description}
              </p>
            </motion.div>

            {/* Illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: passwordFocused ? -8 : [0, -12, 0],
                rotate: emailFocused ? [0, 2, -2, 0] : [0, -1, 1, 0],
              }}
              transition={{
                opacity: { delay: 0.2 },
                scale: { delay: 0.2, type: "spring", stiffness: 200 },
                y: passwordFocused
                  ? { duration: 0.3 }
                  : {
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                rotate: emailFocused
                  ? {
                      duration: 0.5,
                      repeat: 0,
                    }
                  : {
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
              }}
              className="relative bg-white rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 30px rgba(255, 255, 255, 0.1)',
              }}
            >
              <img
                src={roleConfig[selectedRole].image}
                alt={selectedRole}
                className="w-40 h-40 object-contain"
              />
            </motion.div>

            {/* Floating Particles */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                  y: [0, -100],
                  x: [0, Math.random() * 40 - 20],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
                className="absolute bottom-0 w-2 h-2 bg-white rounded-full"
                style={{
                  left: `${20 + i * 15}%`,
                }}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}