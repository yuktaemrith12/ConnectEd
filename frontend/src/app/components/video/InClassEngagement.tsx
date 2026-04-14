/**
 * InClassEngagement — Real-Time Engagement Dashboard
 *
 * Connects to the Flask-SocketIO inference server (localhost:5000).
 * Receives live emotion-detection results and renders a glassmorphism
 * engagement panel with score gauge, per-emotion bars, and confusion alerts.
 *
 * Usage inside <LiveKitRoom>:
 *   const engagementRef = useRef<InClassEngagementHandle>(null);
 *   <InClassEngagement ref={engagementRef} />
 *   // Emit a frame:
 *   engagementRef.current?.sendFrame(base64DataUrl);
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, AlertTriangle, Brain, Wifi, WifiOff } from "lucide-react";
import { io, Socket } from "socket.io-client";

// ── Types ─────────────────────────────────────────────────────────────────

interface EngagementMetrics {
  score: number;
  counts: { Engaged: number; Confused: number; Disengaged: number };
  percentages: { Engaged: number; Confused: number; Disengaged: number };
  total: number;
  alert: boolean;
  fps: number;
  inference_ms: number;
}

export interface InClassEngagementHandle {
  /** Emit a JPEG base64 data-URL frame to the inference server. */
  sendFrame: (base64: string) => void;
}

const INFERENCE_URL = "http://localhost:5000";

// ── Sub-components ────────────────────────────────────────────────────────

/** SVG arc gauge for the overall engagement score (0-100). */
function ScoreGauge({ score }: { score: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(score, 100) / 100);
  const color =
    score >= 70 ? "#4ade80" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* Track */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="7"
        />
        {/* Progress arc */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease",
          }}
        />
      </svg>
      {/* Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white leading-none">
          {Math.round(score)}
        </span>
        <span className="text-[10px] text-white/50 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

/** Single horizontal emotion bar. */
function EmotionBar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/70 font-medium">{label}</span>
        <span className="text-xs text-white font-semibold">
          {value}{" "}
          <span className="text-white/40">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

const InClassEngagement = forwardRef<InClassEngagementHandle>((_, ref) => {
  const socketRef   = useRef<Socket | null>(null);
  const alertTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connected, setConnected] = useState(false);
  const [metrics,   setMetrics]   = useState<EngagementMetrics | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Connect to the inference server on mount
  useEffect(() => {
    const socket = io(INFERENCE_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect",       () => setConnected(true));
    socket.on("disconnect",    () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("result", (data: { metrics: EngagementMetrics }) => {
      setMetrics(data.metrics);

      // Show alert banner for 5 s when >40 % are confused/disengaged
      if (data.metrics.alert) {
        setShowAlert(true);
        if (alertTimer.current) clearTimeout(alertTimer.current);
        alertTimer.current = setTimeout(() => setShowAlert(false), 5000);
      }
    });

    return () => {
      socket.disconnect();
      if (alertTimer.current) clearTimeout(alertTimer.current);
    };
  }, []);

  // Expose sendFrame to parent
  useImperativeHandle(ref, () => ({
    sendFrame(base64: string) {
      if (socketRef.current?.connected) {
        socketRef.current.emit("frame", { image: base64 });
      }
    },
  }));

  return (
    <div
      className="w-72 rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(8, 8, 18, 0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-purple-400" />
          <span className="text-white text-sm font-semibold tracking-tight">
            Live Engagement
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <Wifi size={11} className="text-green-400" />
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 bg-red-400/80 rounded-full" />
              <WifiOff size={11} className="text-red-400" />
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-4 flex-1">
        {/* Not connected */}
        {!connected && (
          <div className="text-center py-5 space-y-2">
            <WifiOff size={28} className="text-white/25 mx-auto" />
            <p className="text-white/45 text-xs leading-relaxed">
              Inference server offline.
              <br />
              Ensure{" "}
              <span className="font-mono text-white/65">app.py</span> is
              running on port 5000.
            </p>
          </div>
        )}

        {/* Connected but no data yet */}
        {connected && !metrics && (
          <div className="text-center py-5 space-y-2">
            <Activity
              size={28}
              className="text-purple-400/60 mx-auto animate-pulse"
            />
            <p className="text-white/45 text-xs">
              Waiting for first frame…
            </p>
          </div>
        )}

        {/* Live metrics */}
        {connected && metrics && (
          <>
            {/* Circular score gauge */}
            <div className="flex items-center justify-center pt-1">
              <ScoreGauge score={metrics.score} />
            </div>

            {/* Emotion distribution bars */}
            <div className="space-y-2.5">
              <EmotionBar
                label="Engaged"
                value={metrics.counts.Engaged}
                pct={metrics.percentages.Engaged}
                color="#4ade80"
              />
              <EmotionBar
                label="Confused"
                value={metrics.counts.Confused}
                pct={metrics.percentages.Confused}
                color="#fbbf24"
              />
              <EmotionBar
                label="Disengaged"
                value={metrics.counts.Disengaged}
                pct={metrics.percentages.Disengaged}
                color="#f87171"
              />
            </div>

            {/* Footer: student count + perf stats */}
            <div className="flex justify-between text-[10px] text-white/35 pt-1 border-t border-white/10">
              <span>
                {metrics.total} student
                {metrics.total !== 1 ? "s" : ""} detected
              </span>
              <span>
                {metrics.fps.toFixed(1)} FPS · {metrics.inference_ms}ms
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Alert banner (slides in from bottom) ── */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            key="alert"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-amber-500/30 bg-amber-500/15 px-4 py-2.5 flex items-start gap-2 overflow-hidden flex-shrink-0"
          >
            <AlertTriangle
              size={14}
              className="text-amber-400 mt-0.5 flex-shrink-0 animate-pulse"
            />
            <p className="text-amber-200 text-xs leading-relaxed">
              <span className="font-semibold">Confusion spike!</span> Over
              40 % of students appear confused or disengaged.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

InClassEngagement.displayName = "InClassEngagement";
export default InClassEngagement;
