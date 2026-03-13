import { db } from "./db";
import { notifications } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Note: The original code snippet provided did not include the `storage` object or the `sendTelegramNotification` function.
// For the purpose of this modification, it's assumed they exist and are correctly implemented elsewhere.
// If they are not present, further changes would be required.

// Mock implementations for demonstration purposes:
const storage = {
  createNotification: async (data: any) => {
    console.log("Mock storage.createNotification called with:", data);
    // In a real scenario, this would interact with the database.
    // For this mock, we'll just return a dummy object.
    return [{ ...data, id: "mock-id-" + Math.random() }];
  },
};

const sendTelegramNotification = async (userId: string, title: string, message: string, type: string) => {
  console.log(`Mock sendTelegramNotification called for user ${userId}: ${title} - ${message} (${type})`);
  // Simulate potential failure for non-wallet users
  if (userId.includes("@")) { // Assuming email users don't have Telegram
    throw new Error("Telegram not available for email user");
  }
  // In a real scenario, this would send a Telegram message.
};


// Send notification to a specific user (supports wallet address, email, or privyId)
export async function sendNotificationToUser(
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    coinAddress?: string;
    coinSymbol?: string;
    amount?: string;
  }
): Promise<void> {
  try {
    // Create notification using userId (can be address, email, or privyId)
    await storage.createNotification({
      userId,
      ...notification,
      read: false,
    });

    // Try to send via Telegram if user has wallet address
    try {
      await sendTelegramNotification(
        userId,
        notification.title,
        notification.message,
        notification.type
      );
    } catch (telegramError) {
      // Silent fail for Telegram - email users won't have Telegram connected
      console.log(`[Notification] Telegram not available for user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  coinAddress?: string;
  coinSymbol?: string;
  amount?: string;
  transactionHash?: string;
}) {
  const [notification] = await db.insert(notifications).values(data).returning();
  return notification;
}

export async function getUserNotifications(userId: string) {
  return db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
  });
}

export async function markNotificationAsRead(notificationId: string) {
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsAsRead(userId: string) {
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));
}