import { useEffect, useState } from "react";
import { useT } from "../i18n";

/**
 * The app keeps working offline — everything is stored on the device — so this
 * explains what still works rather than blocking the screen.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const t = useT();

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner">{t("offline.message")}</div>
  );
}
