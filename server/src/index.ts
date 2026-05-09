import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import path from "path";
import { config } from "./config.js";
import { taskRoutes } from "./routes/tasks.js";
import { templateRoutes } from "./routes/templates.js";
import { materialRoutes } from "./routes/materials.js";
import { uploadRoutes } from "./routes/upload.js";
import { fileRoutes } from "./routes/files.js";
import { exportRoutes } from "./routes/export.js";
import { taskQueue } from "./services/queue.js";

const app = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  },
  bodyLimit: config.maxUploadSize,
});

// ─── Plugins ────────────────────────────────────────────────

await app.register(fastifyCors, {
  origin: true,
  credentials: true,
});

await app.register(fastifyMultipart, {
  limits: {
    fileSize: config.maxUploadSize,
    files: 1000,
  },
});

await app.register(fastifyStatic, {
  root: path.join(config.rootDir, "client", "dist"),
  prefix: "/",
  decorateReply: false,
});

await app.register(fastifyWebsocket);

// ─── WebSocket for real-time progress ──────────────────────

app.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (socket, _req) => {
    const unsubscribe = taskQueue.onProgress((payload) => {
      if (socket.readyState === 1) { // OPEN
        socket.send(JSON.stringify(payload));
      }
    });

    socket.on("close", () => {
      unsubscribe();
    });
  });
});

// ─── API Routes ────────────────────────────────────────────

await taskRoutes(app);
await templateRoutes(app);
await materialRoutes(app);
await uploadRoutes(app);
await fileRoutes(app);
await exportRoutes(app);

// ─── Serve SPA fallback (for React Router) ─────────────────

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith("/api/") || request.url.startsWith("/ws")) {
    return reply.status(404).send({ error: "Not found" });
  }

  // Serve index.html for SPA routes
  const indexPath = path.join(config.rootDir, "client", "dist", "index.html");
  const { readFile } = await import("fs/promises");

  try {
    const html = await readFile(indexPath, "utf-8");
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.send(html);
  } catch {
    // Client not built yet
    reply.status(200).send({
      message: "VideoCuts API Server is running",
      version: "1.0.0",
      endpoints: {
        tasks: "/api/tasks",
        upload: "/api/upload/*",
        export: "/api/export/*",
        queue: "/api/queue",
        ws: "ws://localhost:" + config.port + "/ws",
      },
    });
  }
});

// ─── Start ─────────────────────────────────────────────────

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Server running at http://localhost:${config.port}`);
  app.log.info(`WebSocket at ws://localhost:${config.port}/ws`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
