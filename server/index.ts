import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Needed in production behind reverse proxies (Render) so secure cookies work correctly.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// CORS for split-origin deployments (e.g. Cloudflare Pages frontend -> Render backend)
// Configure with CORS_ORIGINS="https://your.pages.dev,https://your-custom-domain"
// Supports wildcard subdomains via "*." prefix, e.g.:
//   CORS_ORIGINS=https://near-place-map.pages.dev,https://*.near-place-map.pages.dev
const allowedOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function originAllowed(origin: string): { allow: boolean; allowCredentials: boolean } {
  if (!origin) return { allow: false, allowCredentials: false };
  if (allowedOrigins.length === 0) return { allow: false, allowCredentials: false };

  // Special case: "*" allows all origins but cannot be used with credentials.
  if (allowedOrigins.includes("*")) return { allow: true, allowCredentials: false };

  try {
    const o = new URL(origin);
    for (const pattern of allowedOrigins) {
      // Exact origin match (recommended)
      if (pattern === origin) return { allow: true, allowCredentials: true };

      // Wildcard host match: https://*.example.com
      if (pattern.includes("*")) {
        const p = new URL(pattern.replace("*.", "wildcard."));
        if (p.protocol !== o.protocol) continue;
        if (p.port && p.port !== o.port) continue;
        const suffix = p.hostname.replace(/^wildcard\./, "");
        if (o.hostname === suffix || o.hostname.endsWith(`.${suffix}`)) {
          return { allow: true, allowCredentials: true };
        }
      }
    }
  } catch {
    // ignore invalid origins/patterns
  }

  return { allow: false, allowCredentials: false };
}

app.use((req, res, next) => {
  const origin = String(req.headers.origin || "").trim();
  if (origin && allowedOrigins.length > 0) {
    const decision = originAllowed(origin);
    if (decision.allow) {
      res.setHeader("Access-Control-Allow-Origin", decision.allowCredentials ? origin : "*");
      if (decision.allowCredentials) res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Admin-Token, x-admin-token",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Don't crash the dev server on handled API errors.
    console.error(err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // `reusePort` is not supported on Windows (Node will throw ENOTSUP).
  // Enable it only on platforms that support SO_REUSEPORT.
  const listenOptions: Parameters<typeof httpServer.listen>[0] = {
      port,
      host: "0.0.0.0",
    ...(process.platform !== "win32" ? { reusePort: true } : {}),
  };

  httpServer.listen(listenOptions, () => {
      log(`serving on port ${port}`);
  });
})();
