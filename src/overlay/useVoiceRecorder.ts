import { useCallback, useEffect, useRef } from "react";
import { transcribe } from "../ipc/commands";
import { useAppStore } from "../store/useAppStore";

type Options = {
  onTranscript: (text: string) => void;
};

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
  const setVoiceStatus = useAppStore((s) => s.setVoiceStatus);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        setVoiceStatus("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          chunksRef.current = [];
          if (blob.size > 0) {
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

      recorderRef.current = rec;
      rec.start();
      setVoiceStatus("recording");
    } catch (err) {
      console.error("mic access denied", err);
      setVoiceStatus("idle");
    }
  }, [onTranscript, setVoiceStatus, stop]);

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
