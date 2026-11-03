import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import router from "./src/routes";
import { globalErrorHandler } from "./src/middleware/globalErrorHandler";

dotenv.config();

async function startServer() {
  const app: Application = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Disable Mongoose command buffering so queries never hang if the database is offline
  mongoose.set("bufferCommands", false);

  // MongoDB Connection
  const mongoUri = process.env.MONGODB_URI;
  if (
    mongoUri &&
    mongoUri.trim() &&
    !mongoUri.includes("your_mongodb_connection_string_here")
  ) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log("✅ MongoDB Connected successfully");
    } catch (err: any) {
      const errorDetail =
        err?.code === "ENOTFOUND" || err?.syscall === "querySrv"
          ? `Host DNS not found (${err?.hostname || "unresolvable domain"}). Check MONGODB_URI.`
          : err?.message || "Connection unreachable";
      console.warn(`⚠️ [Database] MongoDB is not reachable: ${errorDetail}`);
      console.log(
        "ℹ️ [Database] Continuing seamlessly in persistent in-memory database mode.",
      );
    }
  } else {
    console.log(
      "ℹ️ [Database] Operating in persistent in-memory database mode.",
    );
  }

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());
  app.use(
    "/uploads/dealer-receipts",
    express.static(
      path.join(process.cwd(), "data", "dealer-receipts", "images"),
    ),
  );

  // Request Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === "POST" && req.path !== "/api/v1/dealer-receipts") {
      console.log("Body:", req.body);
    }
    next();
  });

  // API Routes
  app.use("/api/v1", router);

  app.get("/api/health", (req, res) => {
    res.json({
      status: "UP",
      timestamp: new Date(),
      env: process.env.NODE_ENV,
      port: PORT,
    });
  });

  // Global Error Handler
  app.use(globalErrorHandler);

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
