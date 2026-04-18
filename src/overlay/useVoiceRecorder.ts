import { useCallback, useEffect, useRef } from "react";
import { transcribe } from "../ipc/commands";
import { useAppStore } from "../store/useAppStore";

type Options = {
  onTranscript: (text: string) => void;
};

// VAD (voice activity detection) tuning.
// SPEECH_RMS ─ root-mean-square above which a frame counts as speech.
// SILENCE_RMS ─ frames below this reset the "just stopped" timer.
// SILENCE_HOLD_MS ─ how long we stay quiet before auto-submitting (Siri-like).
// GRACE_MS ─ ignore silence during this startup window so the user has time
//            to begin speaking.
// MAX_MS ─ safety cap on a single recording.
const SPEECH_RMS = 0.035;
const SILENCE_HOLD_MS = 1200;
const GRACE_MS = 2500;
const MAX_MS = 30_000;

function pickMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return "audio/webm";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function useVoiceRecorder({ onTranscript }: Options) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastSpeechAtRef = useRef<number>(0);
  const hasSpokenRef = useRef(false);
  const setVoiceStatus = useAppStore((s) => s.setVoiceStatus);

  const teardownVad = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "closed") {
      void ctx.close();
    }
    audioCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    teardownVad();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, [teardownVad]);

  const start = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      // Already listening — user wants to cut short and submit.
      stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      hasSpokenRef.current = false;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        teardownVad();
        setVoiceStatus("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          chunksRef.current = [];
          if (blob.size > 0 && hasSpokenRef.current) {
            const b64 = await blobToBase64(blob);
            const text = await transcribe(b64, mime);
            const trimmed = text.trim();
            if (trimmed) onTranscript(trimmed);
          }
        } catch (err) {
          console.error("transcription failed", err);
        } finally {
          setVoiceStatus("idle");
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          recorderRef.current = null;
        }
      };

      // Wire up VAD: sample mic RMS each frame and call `stop()` once we see
      // >= SILENCE_HOLD_MS of quiet after the user has actually spoken.
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.25;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (!recorderRef.current || recorderRef.current.state !== "recording") {
          return;
        }
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();

        if (rms > SPEECH_RMS) {
          hasSpokenRef.current = true;
          lastSpeechAtRef.current = now;
        }

        const elapsed = now - startedAtRef.current;
        if (elapsed > MAX_MS) {
          stop();
          return;
        }
        if (
          hasSpokenRef.current &&
          elapsed > GRACE_MS &&
          now - lastSpeechAtRef.current > SILENCE_HOLD_MS
        ) {
          stop();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      recorderRef.current = rec;
      rec.start();
      startedAtRef.current = performance.now();
      lastSpeechAtRef.current = startedAtRef.current;
      setVoiceStatus("recording");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("mic access denied", err);
      setVoiceStatus("idle");
    }
  }, [onTranscript, setVoiceStatus, stop, teardownVad]);

  const toggle = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stop]);

  return { start, stop, toggle };
}
