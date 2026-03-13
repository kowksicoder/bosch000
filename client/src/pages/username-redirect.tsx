import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import NotFound from "@/pages/not-found";

export default function UsernameRedirect() {
  const [, params] = useRoute("/:handle");
  const [, setLocation] = useLocation();
  const handle = params?.handle;

  useEffect(() => {
    if (!handle || !handle.startsWith("@")) return;
    const safeIdentifier = encodeURIComponent(handle.slice(1));
    setLocation(`/profile/${safeIdentifier}`);
  }, [handle, setLocation]);

  if (handle?.startsWith("@")) return null;

  return <NotFound />;
}
