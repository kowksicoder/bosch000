declare global {
  var telegramBotInitialized: boolean | undefined;
  var isShuttingDown: boolean | undefined;
}


// ensure environment files are loaded. Load base .env first, then
// allow .env.development to override when running in development.
import dotenv from 'dotenv';
import path from 'path';

// Always load base .env if present so users can keep DATABASE_URL there.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// If running in development, also load (and allow) .env.development to override values.
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.development'), override: true });
}

// Database URL should come from Replit Secrets or local .env files.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found. Make sure Replit PostgreSQL database is provisioned or set DATABASE_URL in .env/.env.development.');
}

// Verify Supabase credentials
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('⚠️ Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { storage } from "./supabase-storage";
import { createE1XPRouter } from './routes/e1xp';
// import { autoMigrateOnStartup } from "./migrate-old-data"; // Disabled - uses direct DB connection
import { setupVite, serveStatic, log } from "./vite";
import { initTelegramBot } from "./telegram-bot";
import { ActivityTrackerCron } from "./activity-tracker-cron";
import { base } from "viem/chains";

const app = express();

// Session configuration for admin
app.use(session({
  secret: process.env.SESSION_SECRET || 'creatorland-admin-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize Socket.io
  const { initializeSocketServer } = await import('./socket-server');
  const io = initializeSocketServer(server);
  
  // Pass Socket.io to admin routes
  const { setSocketIO } = await import('./routes/admin');
  setSocketIO(io);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || "0.0.0.0";
  const reusePort = process.platform !== "win32";
  server.listen({
    port,
    host,
    ...(reusePort ? { reusePort: true } : {}),
  }, () => {
    log(`serving on ${host}:${port}`);
  });

  // Initialize Telegram bot (only once) - done after server.listen so port opens quickly
  if (!global.telegramBotInitialized && !global.isShuttingDown) {
    try {
      await initTelegramBot();
      global.telegramBotInitialized = true;
      console.log('✅ Telegram bot initialized and marked as global');
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      global.telegramBotInitialized = false;
    }
  } else if (global.telegramBotInitialized) {
    console.log('ℹ️  Telegram bot already initialized globally, skipping...');
  }

  // Start trending notifications
  const { startTrendingNotifications } = await import('./trending-notifications');
  startTrendingNotifications();

  // Run automatic migration on startup
  // Disabled - uses direct database connection instead of Supabase SDK
  // try {
  //   await autoMigrateOnStartup();
  // } catch (error) {
  //   console.error("Failed to run auto migration:", error);
  // }

  // Initialize and start activity tracker cron job
  const activityTrackerCron = new ActivityTrackerCron(storage, base.id);
  activityTrackerCron.start();
  log(`Activity tracker cron started with schedule: ${activityTrackerCron.getSchedule()}`);

  // Initialize and start notification cron jobs
  const { scheduleNotificationJobs } = await import('./notification-cron');
  scheduleNotificationJobs();

  // Schedule reward reminder cron job (runs daily at 10 AM)
  const cron = await import('node-cron');
  const { sendUnclaimedRewardReminders } = await import('./reward-reminder-cron');
  cron.schedule('0 10 * * *', async () => {
    console.log('🔔 Running daily reward reminder job...');
    await sendUnclaimedRewardReminders();
  });
  console.log('✅ Reward reminder cron job scheduled (daily at 10 AM)');

  // Start streak reminder cron service
  const { startStreakReminderCron } = await import('./streak-reminder-cron');
  startStreakReminderCron();
  console.log('✅ Streak reminder cron started (runs at 9 AM, 3 PM, and 9 PM daily)');

  // Start Zora creator rewards poller
  const { startZoraRewardsPoller } = await import('./zora-rewards-poller');
  startZoraRewardsPoller();
  console.log('✅ Zora rewards poller started');

  // Start auto-settlement cron
  const { AutoSettlementCron } = await import('./auto-settlement-cron');
  const autoSettlementCron = new AutoSettlementCron();
  autoSettlementCron.start();
  console.log('✅ Auto-settlement cron started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    if (global.isShuttingDown) {
      console.log('Already shutting down, please wait...');
      return;
    }
    
    global.isShuttingDown = true;
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    try {
      const { stopTelegramBot } = await import('./telegram-bot');
      await stopTelegramBot();
      global.telegramBotInitialized = false;
      
      activityTrackerCron.stop();
      autoSettlementCron.stop();
      
      console.log('✅ All services stopped successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
})();
