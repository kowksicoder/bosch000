// Mock authentication middleware
// TODO: Replace with Privy authentication integration
// For now, using a seeded user as the mock current user

import { storage } from "./storage";

let mockCurrentUserId: string | null = null;

export async function initMockAuth() {
  // Get the first user from the database as our mock current user
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const users = await storage.getTrendingCreators(1);
      if (users.length > 0) {
        mockCurrentUserId = users[0].id;
        console.log(`🔐 Mock auth initialized with user: ${users[0].username} (${mockCurrentUserId})`);
        return;
      }
      break;
    } catch (error) {
      lastError = error;
      retries--;
      if (retries > 0) {
        console.log(`⚠️ Database connection failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }
  }
  
  if (lastError) {
    console.error('❌ Failed to initialize mock auth after multiple attempts:', lastError);
    throw lastError;
  }
}

export function getMockCurrentUserId(): string {
  if (!mockCurrentUserId) {
    throw new Error("Mock auth not initialized");
  }
  return mockCurrentUserId;
}

export function setMockCurrentUserId(userId: string) {
  mockCurrentUserId = userId;
}

// Alias exports for compatibility
export function getCurrentUserId(): string {
  return getMockCurrentUserId();
}

export function setCurrentUserId(userId: string): void {
  setMockCurrentUserId(userId);
}
