import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useAppStore } from "../store/useAppStore";

export default function ResponseBubble() {
  const messages = useAppStore((s) => s.messages);
  const last = messages[messages.length - 1];
  const visible = last && last.role === "assistant" && last.content.length > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={last.id}
          className="pointer-events-auto fixed left-1/2 bottom-[18%] w-[min(820px,70vw)] max-w-[calc(100vw-4rem)] max-h-[52vh] -translate-x-1/2 overflow-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-2xl border border-white/10 bg-ink-900/80 px-6 py-5 shadow-glow-soft backdrop-blur-xl">
            <article className="prose prose-invert prose-sm max-w-none text-white/90">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {last.content}
              </ReactMarkdown>
            </article>
            {last.pending && (
              <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-glow-violet" />
                <span>Jarvis réfléchit…</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
