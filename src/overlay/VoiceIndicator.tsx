import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../store/useAppStore";

export default function VoiceIndicator() {
  const status = useAppStore((s) => s.voiceStatus);
  const visible = status !== "idle";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed left-1/2 bottom-[8%] -translate-x-1/2"
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-ink-900/75 px-5 py-2.5 shadow-glow-soft backdrop-blur-xl">
            {status === "recording" ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-sm text-white/85">
                  À l'écoute… (appuyez à nouveau pour envoyer)
                </span>
              </>
            ) : (
              <>
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-glow-violet" />
                <span className="text-sm text-white/85">
                  Transcription en cours…
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
