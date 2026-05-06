import { useCallback, useEffect, useRef } from "react";
import { transcribe } from "../ipc/commands";
import { useAppStore } from "../store/useAppStore";

type Options = {
  // Called with the transcribed text once an utterance is captured and STT
  // returns a non-empty string.
  onTranscript: (text: string) => void;
  // Fired the moment the VAD detects the user has started speaking. The host
  // should cancel any in-flight AI stream / TTS here so the assistant gets
  // out of the way (barge-in).
  onSpeechStart?: () => void;
};

// VAD tuning (Siri-like behaviour).
// SPEECH_RMS ─ mic RMS above which a frame counts as speech.
// SILENCE_HOLD_MS ─ quiet time after last speech frame before we submit.
// MIN_UTTERANCE_MS ─ below this length we discard (cough, chair squeak…).
// MAX_UTTERANCE_MS ─ hard cap so a jammed mic never records forever.
const SPEECH_RMS = 0.04;
const SILENCE_HOLD_MS = 1100;
const MIN_UTTERANCE_MS = 350;
const MAX_UTTERANCE_MS = 30_000;

type SessionState = "idle" | "listening" | "recording" | "transcribing";

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

/**
 * Continuous voice session. Opens the mic once, then runs an always-on VAD
 * loop: when the user speaks, MediaRecorder starts; when they go quiet, the
 * utterance is transcribed and forwarded via `onTranscript`. The mic stays
 * open for the whole session so the user can barge in on the assistant at
 * any moment — `onSpeechStart` fires each time so the host can stop TTS and
 * cancel the current AI stream.
 */
export function useVoiceRecorder({ onTranscript, onSpeechStart }: Options) {
  const stateRef = useRef<SessionState>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const rafRef = useRef<number | null>(null);
  const speechStartAtRef = useRef<number>(0);
  const lastSpeechAtRef = useRef<number>(0);
  const setVoiceStatus = useAppStore((s) => s.setVoiceStatus);

  const submitRecorded = useCallback(async () => {
    if (stateRef.current === "idle") return;
    stateRef.current = "transcribing";
    setVoiceStatus("transcribing");
    try {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: mimeRef.current });
      // Filter out blips too small to be real speech.
      if (blob.size < 800) return;
      const b64 = await blobToBase64(blob);
      const text = await transcribe(b64, mimeRef.current);
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
    } catch (err) {
      console.error("transcription failed", err);
    } finally {
      if ((stateRef.current as SessionState) !== "idle") {
        stateRef.current = "listening";
        setVoiceStatus("listening");
      }
    }
  }, [onTranscript, setVoiceStatus]);

  const beginRecording = useCallback(() => {
    if (!streamRef.current || stateRef.current === "recording") return;
    try {
      const rec = new MediaRecorder(streamRef.current, {
        mimeType: mimeRef.current,
      });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void submitRecorded();
      };
      recorderRef.current = rec;
      rec.start();
      const now = performance.now();
      stateRef.current = "recording";
      speechStartAtRef.current = now;
      lastSpeechAtRef.current = now;
      setVoiceStatus("recording");
      onSpeechStart?.();
    } catch (err) {
      console.error("begin recording failed", err);
    }
  }, [onSpeechStart, setVoiceStatus, submitRecorded]);

  const endRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }, []);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return;

    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();
    const state = stateRef.current;

    if (state === "listening") {
      if (rms > SPEECH_RMS) {
        beginRecording();
      }
    } else if (state === "recording") {
      if (rms > SPEECH_RMS) {
        lastSpeechAtRef.current = now;
      }
      const utteranceMs = now - speechStartAtRef.current;
      if (utteranceMs > MAX_UTTERANCE_MS) {
        endRecording();
        return;
      }
      if (
        utteranceMs > MIN_UTTERANCE_MS &&
        now - lastSpeechAtRef.current > SILENCE_HOLD_MS
      ) {
        endRecording();
      }
    }
  }, [beginRecording, endRecording]);

  const open = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      mimeRef.current = pickMime();

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));

      stateRef.current = "listening";
      setVoiceStatus("listening");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("mic access denied", err);
      stateRef.current = "idle";
      setVoiceStatus("idle");
    }
  }, [setVoiceStatus, tick]);

  const close = useCallback(() => {
    stateRef.current = "idle";
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {}
    }
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "closed") void ctx.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    setVoiceStatus("idle");
  }, [setVoiceStatus]);

  useEffect(() => {
    return () => close();
  }, [close]);

  return { open, close };
}
