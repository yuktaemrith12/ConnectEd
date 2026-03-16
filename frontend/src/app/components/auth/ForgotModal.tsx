import { motion, AnimatePresence } from "motion/react";
import { X, Mail, KeyRound } from "lucide-react";

interface ForgotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ADMIN_EMAIL = "yuktae@admin.connected.com";
const MAILTO_LINK = `mailto:${ADMIN_EMAIL}?subject=Password%20Reset%20Request%20-%20ConnectEd&body=Hello%20Administrator%2C%0D%0A%0D%0AI%20need%20to%20reset%20my%20password%20for%20my%20ConnectEd%20account.%0D%0A%0D%0AEmail%3A%20%5BUser%20to%20fill%5D%0D%0A%0D%0AI%20understand%20that%20a%20temporary%20password%20will%20be%20granted%20to%20me.%0D%0A%0D%0AThank%20you.`;

export default function ForgotModal({ isOpen, onClose }: ForgotModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden">
              {/* Decorative gradient strip at top */}
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />

              <div className="p-8">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <KeyRound size={28} className="text-white" />
                  </div>
                </div>

                {/* Heading */}
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  Forgot your password?
                </h2>
                <p className="text-gray-500 text-center text-sm mb-6 leading-relaxed">
                  Password resets are handled by your school administrator.
                  Send them an email and a temporary password will be arranged for you.
                </p>

                {/* Email card */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-medium mb-0.5">Administrator Email</p>
                    <p className="text-sm font-semibold text-gray-700 truncate">{ADMIN_EMAIL}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3">
                  <motion.a
                    href={MAILTO_LINK}
                    whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(59,130,246,0.35)" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold text-center text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Mail size={16} />
                    Open Email Client
                  </motion.a>

                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Back to Login
                  </button>
                </div>

                {/* Fine print */}
                <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
                  If your email client doesn't open, copy the address above and send a
                  manual request.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
