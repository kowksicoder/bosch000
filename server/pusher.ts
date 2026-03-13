import Pusher from "pusher";

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER;

let pusherClient: Pusher | null = null;

export function getPusher(): Pusher | null {
  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  if (!pusherClient) {
    pusherClient = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  return pusherClient;
}

export function canUsePusher(): boolean {
  return Boolean(appId && key && secret && cluster);
}

export async function triggerUserNotification(userId: string, payload: any) {
  const client = getPusher();
  if (!client) return;

  await client.trigger(`private-user-${userId}`, "notification", payload);
}

export function authorizeChannel(socketId: string, channelName: string) {
  const client = getPusher();
  if (!client) {
    throw new Error("Pusher is not configured");
  }

  return client.authenticate(socketId, channelName);
}
