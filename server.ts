import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createNotificationsRouter } from "./server/notifications";
import { createBookingsRouter } from "./server/bookings";
import { createEngagementRouter } from "./server/engagement";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '32kb' }));

// Notification channel dispatch + provider status webhooks.
// This is how salon-side confirmations (booking_confirmed etc.) reach users.
app.use("/api/notifications", createNotificationsRouter(process.env));

// Server-side booking creation (multi-service line items + metadata.services).
// Enabled only when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured;
// otherwise it answers 503 "not configured" and never fabricates a booking.
app.use("/api/bookings", createBookingsRouter(process.env));

// Engagement: user QR codes, salon check-ins, rewards ledger summary.
// Same trust model as bookings — service-role only.
app.use("/api/engagement", createEngagementRouter(process.env));

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Start Server with Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexora SalonOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
