import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { config } from "../config.js";

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  // Serve uploaded files
  app.get<{ Params: { filename: string } }>(
    "/uploads/:filename",
    async (req, reply) => {
      const filePath = path.join(config.uploadsDir, path.basename(req.params.filename));
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }
      const stat = fs.statSync(filePath);
      reply.header("Content-Type", "video/mp4");
      reply.header("Content-Length", stat.size);
      return reply.send(fs.createReadStream(filePath));
    }
  );

  // Serve output files
  app.get<{ Params: { taskId: string; filename: string } }>(
    "/outputs/:taskId/:filename",
    async (req, reply) => {
      const filePath = path.join(
        config.outputsDir,
        path.basename(req.params.taskId),
        path.basename(req.params.filename)
      );
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }
      const stat = fs.statSync(filePath);
      reply.header("Content-Type", "video/mp4");
      reply.header("Content-Length", stat.size);
      return reply.send(fs.createReadStream(filePath));
    }
  );

  // Serve task thumbnails
  app.get<{ Params: { taskId: string; filename: string } }>(
    "/thumbnails/:taskId/:filename",
    async (req, reply) => {
      const filePath = path.join(
        config.outputsDir,
        path.basename(req.params.taskId),
        path.basename(req.params.filename)
      );
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "Thumbnail not found" });
      }
      const stat = fs.statSync(filePath);
      reply.header("Content-Type", "image/jpeg");
      reply.header("Content-Length", stat.size);
      return reply.send(fs.createReadStream(filePath));
    }
  );

  // Serve material thumbnails
  app.get<{ Params: { filename: string } }>(
    "/api/materials-thumb/:filename",
    async (req, reply) => {
      const thumbDir = path.join(config.outputsDir, "thumbnails");
      const filePath = path.join(thumbDir, path.basename(req.params.filename));
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "Thumbnail not found" });
      }
      const stat = fs.statSync(filePath);
      reply.header("Content-Type", "image/jpeg");
      reply.header("Content-Length", stat.size);
      return reply.send(fs.createReadStream(filePath));
    }
  );
}
