import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, _res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJson: Record<string, unknown> | undefined;
  next();
  const duration = Date.now() - start;
  if (path.startsWith("/api")) {
    console.log(`${req.method} ${path} in ${duration}ms`);
  }
});

(async () => {
  registerRoutes(httpServer, app);

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    const status = (err as any).status || 500;
    if (res.headersSent) return next(err);
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }
})();

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
  console.log(`[cardano-quiz] Server running on port ${port}`);
});
