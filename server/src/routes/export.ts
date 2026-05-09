import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { config } from "../config.js";
import { db } from "../db.js";

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  // Download single video
  app.get<{ Params: { taskId: string; filename: string } }>(
    "/api/export/:taskId/:filename",
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
      reply.header("Content-Disposition", `attachment; filename="${req.params.filename}"`);

      return reply.send(fs.createReadStream(filePath));
    }
  );

  // Batch download all completed renders from a task as zip
  app.get<{ Params: { taskId: string } }>(
    "/api/export/:taskId/zip",
    async (req, reply) => {
      const { taskId } = req.params;

      const row = db.prepare("SELECT results_json, name FROM tasks WHERE id = ?").get(taskId) as
        | { results_json: string; name: string }
        | undefined;

      if (!row) return reply.status(404).send({ error: "Task not found" });

      const results = JSON.parse(row.results_json) as { outputPath: string; status: string }[];
      const completed = results.filter((r) => r.status === "completed");

      if (completed.length === 0) {
        return reply.status(400).send({ error: "No completed renders to download" });
      }

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="${row.name}_export.zip"`);

      // Create zip stream
      const archive = archiver("zip", { zlib: { level: 5 } });
      archive.pipe(reply.raw);

      for (const result of completed) {
        const filePath = path.join(
          config.outputsDir,
          path.basename(taskId),
          path.basename(result.outputPath.replace("/outputs/" + taskId + "/", ""))
        );

        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: path.basename(filePath) });
        }
      }

      await archive.finalize();
    }
  );

  // Delete task output files
  app.delete<{ Params: { taskId: string } }>(
    "/api/export/:taskId",
    async (req, reply) => {
      const taskDir = path.join(config.outputsDir, path.basename(req.params.taskId));
      if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true, force: true });
      }
      reply.send({ ok: true });
    }
  );
}
