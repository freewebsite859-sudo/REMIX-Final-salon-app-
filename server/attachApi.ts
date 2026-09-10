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

export function attachNexoraApi(app: Express, env: NodeJS.ProcessEnv = process.env): void {
  app.use('/api/notifications', createNotificationsRouter(env));
  app.use('/api/bookings', createBookingsRouter(env));
  app.use('/api/payments', createPaymentsRouter(env));
  app.use('/api/engagement', createEngagementRouter(env));
  // Invite-link attribution: GET /resolve, POST /accept, GET /:userId
  app.use('/api/referrals', createReferralsRouter(env));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });
}
