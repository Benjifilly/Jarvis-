import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "../styles/glow.css";

type Props = {
  active: boolean;
};

export default function GlowBorder({ active }: Props) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const unlisten = listen<boolean>("voice://speaking", (e) => {
      setSpeaking(Boolean(e.payload));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      className="glow-root"
      data-active={active}
      data-speaking={speaking}
      aria-hidden
    >
      <div className="glow-halo" />
      <div className="glow-streaks" />
      <div className="glow-shimmer" />
    </div>
  );
}
