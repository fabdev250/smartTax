import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { connectDB } from "./server/models";
import apiRouter from "./server/routes";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Establish Database Connection early on Startup
  await connectDB();

  // Standard middleware
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));
  app.use(cookieParser());

  // Mount API endpoints
  app.use("/api", apiRouter);

  // Health check fallback 
  app.get("/api-health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
  });

  // Serve static assets or mount Vite hot-module middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting full-stack dev server using Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Production Build mode initiated. Serving compiled static assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartTax server boot completed. Listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: SmartTax Server Boot Failure:", err);
});
