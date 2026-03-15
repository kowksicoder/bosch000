import webpush from "web-push";
import { storage } from "./supabase-storage";

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@every1.co";

let vapidConfigured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
} else {
  console.warn("[Push] VAPID keys missing. Push notifications disabled.");
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
};

const normalizeSubscription = (row: any) => {
  if (!row) return null;

  if (row.subscription) {
    try {
      const parsed = typeof row.subscription === "string" ? JSON.parse(row.subscription) : row.subscription;
      if (parsed?.endpoint && parsed?.keys?.p256dh && parsed?.keys?.auth) return parsed;
    } catch (error) {
      console.warn("[Push] Failed to parse subscription JSON", error);
    }
  }

  if (row.endpoint && row.p256dh_key && row.auth_key) {
    return {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh_key,
        auth: row.auth_key,
      },
    };
  }

  return null;
};

export async function sendPushToUsers(
  userIdentifiers: string[],
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured || userIdentifiers.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/notifications",
    icon: payload.icon || "/purple-white.png",
    badge: payload.badge || "/purple-white.png",
    tag: payload.tag,
  });

  for (const identifier of userIdentifiers) {
    try {
      const subscriptions = await storage.getPushSubscriptionsByUser(identifier);
      if (!subscriptions.length) continue;

      await Promise.all(
        subscriptions.map(async (row: any) => {
          const subscription = normalizeSubscription(row);
          if (!subscription) return;

          try {
            await webpush.sendNotification(subscription, message);
          } catch (error: any) {
            const statusCode = error?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              try {
                await storage.deletePushSubscription(identifier, subscription.endpoint);
              } catch (cleanupError) {
                console.warn("[Push] Failed to cleanup subscription", cleanupError);
              }
            } else {
              console.warn("[Push] Failed to send push", error?.message || error);
            }
          }
        }),
      );
    } catch (error) {
      console.warn("[Push] Failed to send push to user", error);
    }
  }
}
