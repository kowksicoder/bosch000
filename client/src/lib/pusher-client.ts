import Pusher from "pusher-js";

let pusherInstance: Pusher | null = null;

export function getPusherClient(accessToken?: string | null) {
  if (pusherInstance) {
    return pusherInstance;
  }

  const key = import.meta.env.VITE_PUSHER_KEY;
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER;

  if (!key || !cluster) {
    return null;
  }

  pusherInstance = new Pusher(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
    auth: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  return pusherInstance;
}

export function disconnectPusher() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
