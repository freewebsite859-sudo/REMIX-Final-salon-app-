import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { attachNexoraApi } from "./server/attachApi";
import { attachInviteRedirects } from "./server/inviteRedirects";

dotenv.config();

const app = express();
// Render/Railway/Fly inject PORT; a hard 3000 makes those hosts crash-loop,
// which is another way an invite link can be "not working" in production.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '32kb' }));

// `/invite?code=NX-…` must answer with a real redirect before Vite/static/SPA
// handling gets a chance, so an invite link opens the signup form even on a cold
// load, on a host without SPA fallback, and with JS disabled.
attachInviteRedirects(app);

// Direct booking inserts are refused (402). The payments router creates the
// booking only after a server-side gateway order + HMAC signature verify.
attachNexoraApi(app);

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

  const server = app.listen(PORT, "0.0.0.0");
  server.once("listening", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : PORT;
    console.log(`Nexora SalonOS server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
