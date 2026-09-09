import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { attachNexoraApi } from "./server/attachApi";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '32kb' }));

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexora SalonOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
