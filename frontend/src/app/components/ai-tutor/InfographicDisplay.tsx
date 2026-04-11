/**
 * InfographicDisplay
 * ------------------
 * Fetches the PNG via axios (sends JWT token) then renders via a blob URL.
 * This avoids the 403 that <img src> causes — browsers don't send auth headers
 * on plain image requests.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ZoomIn, Download, Image as ImageIcon } from "lucide-react";
import { api } from "@/app/utils/api";

export interface InfographicData {
  id: number;
  url: string;                    // relative: /api/v1/ai-tutor/infographics/{id}
  accessibility_alt?: string | null;
  normalized_concept?: string | null;
}

interface Props {
  infographic: InfographicData;
}

export default function InfographicDisplay({ infographic }: Props) {
  const [blobUrl,    setBlobUrl]    = useState<string | null>(null);
  const [error,      setError]      = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const blobRef = useRef<string | null>(null);

  const altText = infographic.accessibility_alt || infographic.normalized_concept || "Academic diagram";

  // Fetch image with auth header, convert to blob URL
  useEffect(() => {
    let cancelled = false;
    api.get<Blob>(infographic.url, { responseType: "blob" })
      .then(res => {
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        blobRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, [infographic.url]);

  function handleSave() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `infographic-${infographic.id}.png`;
    a.click();
  }

  if (error) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
        <ImageIcon size={13} />
        <span>Visual aid unavailable</span>
      </div>
    );
  }

  return (
    <>
      {/* Inline figure */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-4 mb-2 group relative"
      >
        {/* Skeleton while blob URL is loading */}
        {!blobUrl && !error && (
          <div className="w-full h-52 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse rounded-2xl" />
        )}

        {/* Image container — glassmorphism style */}
        {blobUrl && (
          <div
            className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/60 backdrop-blur-sm shadow-md hover:shadow-xl transition-shadow duration-300 cursor-zoom-in"
            onClick={() => setFullscreen(true)}
            title="Click to enlarge"
          >
            <img
              src={blobUrl}
              alt={altText}
              className="w-full object-contain max-h-72 rounded-2xl"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-2xl flex items-center justify-center">
              <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>

            {/* Caption bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-2 rounded-b-2xl flex items-center justify-between">
              <span className="text-white text-xs truncate max-w-[80%] drop-shadow">{altText}</span>
              <button
                onClick={e => { e.stopPropagation(); handleSave(); }}
                className="text-white/80 hover:text-white transition-colors"
                title="Save image"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Full-screen modal */}
      <AnimatePresence>
        {fullscreen && blobUrl && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setFullscreen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-4xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm font-semibold text-gray-700 truncate max-w-[85%]">{altText}</span>
                <div className="flex items-center gap-2">
                  <button onClick={handleSave} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700" title="Save image">
                    <Download size={16} />
                  </button>
                  <button onClick={() => setFullscreen(false)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <img src={blobUrl} alt={altText} className="w-full object-contain max-h-[80vh]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
