"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[70] -translate-x-1/2">
      <div
        className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs text-red-200 shadow-lg backdrop-blur"
      >
        <WifiOff size={14} />
        No internet connection
      </div>
    </div>
  );
}
