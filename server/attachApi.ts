/**
 * Shared Nexora HTTP API surface.
 *
 * Both `tsx server.ts` (Express + Vite middleware) and a bare `vite` dev
 * server must expose the same routes. A Vite-only preview previously 404'd
 * `/api/payments/*` and `/api/bookings`, which surfaced as
 * "Advance Payment Incomplete" with "booking service endpoint was not found".
 */
import type { Express, Request, Response } from 'express';
import { createNotificationsRouter } from './notifications';
import { createBookingsRouter } from './bookings';
import { createPaymentsRouter } from './payments';
import { createEngagementRouter } from './engagement';
import { createReferralsRouter } from './referrals';
import { createUserAccountRouter } from './userAccount';
import { createAiRouter, createReminderComposer } from './ai';
import { createSmartMemoryRouter } from './smartMemory';
import { createPaymentsExtraRouter } from './paymentsExtra';
import { createMapsRouter } from './maps';

export function attachNexoraApi(app: Express, env: NodeJS.ProcessEnv = process.env): void {
  app.use('/api/notifications', createNotificationsRouter(env));
  app.use('/api/bookings', createBookingsRouter(env));
  app.use('/api/payments', createPaymentsRouter(env));
  // Refunds, invoices, payment history + Razorpay webhook (refund.* events)
  app.use('/api/payments', createPaymentsExtraRouter(env));
  // OpenAI-backed recommendations / reminder copy (template fallback when unconfigured)
  app.use('/api/ai', createAiRouter(env));
  // Smart Memory Engine: preferences, reminders, push subscriptions, cron dispatcher
  app.use('/api/smart', createSmartMemoryRouter(env, { composeMessage: (r) => createReminderComposer(env)(r, r.phone ? 'whatsapp' : 'push') }));
  // Google Maps Platform proxy (server key never reaches the browser)
  app.use('/api/maps', createMapsRouter(env));
  app.use('/api/engagement', createEngagementRouter(env));
  // Invite-link attribution: GET /resolve, POST /accept, GET /:userId
  app.use('/api/referrals', createReferralsRouter(env));
  // Account lifecycle: POST /delete (verifies the caller's own access token)
  app.use('/api/user', createUserAccountRouter(env));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });
}
