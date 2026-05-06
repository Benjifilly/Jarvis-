import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import OverlayRoot from "./overlay/OverlayRoot";
import SettingsRoot from "./settings/SettingsRoot";

type Route = "overlay" | "settings";

function resolveInitialRoute(): Route {
  // The Tauri window label drives routing (see src-tauri/tauri.conf.json).
  const label = getCurrentWebviewWindow().label;
  if (label === "settings") return "settings";
  if (typeof window !== "undefined" && window.location.hash === "#/settings") {
    return "settings";
  }
  return "overlay";
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => resolveInitialRoute());

  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash === "#/settings" ? "settings" : "overlay");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route === "settings" ? <SettingsRoot /> : <OverlayRoot />;
}
