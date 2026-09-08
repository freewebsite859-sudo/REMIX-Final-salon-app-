import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createNotificationsRouter } from "./server/notifications";
import { createPaymentsRouter, paymentsWebhookHandler } from "./server/payments";

dotenv.config();

const app = express();
const PORT = 3000;

// Payment webhook MUST see the raw body for HMAC verification, so it is mounted
// before the global express.json parser.
app.post(
  "/api/payments/webhook/razorpay",
  express.raw({ type: "*/*" }),
  (req: Request, res: Response) => {
    void paymentsWebhookHandler(req, res, process.env);
  }
);

app.use(express.json({ limit: '32kb' }));

// Notification channel dispatch + provider status webhooks.
// This is how salon-side confirmations (booking_confirmed etc.) reach users.
app.use("/api/notifications", createNotificationsRouter(process.env));

// Secure online booking payment: config, order creation, server-side
// verification and provider reconciliation.
app.use("/api/payments", createPaymentsRouter(process.env));

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
