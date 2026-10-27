import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/hooks/useOnline";

/** Under every page header while offline: what is on screen is what this device last saw. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-border bg-warn/10 px-4 py-2 text-sm text-warn @tablet:px-6"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>Offline: showing what this device last loaded. Changes and captures wait for a connection.</span>
    </div>
  );
}
