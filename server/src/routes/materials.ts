import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { config } from "../config.js";
import { probeVideo } from "../services/ffmpeg.js";
import type { MaterialLibItem } from "../types.js";

export async function materialRoutes(app: FastifyInstance): Promise<void> {
  // ─── List all materials ─────────────────────────────────

  app.get("/api/materials", async (_req, reply) => {
    const rows = db.prepare(
      "SELECT * FROM materials ORDER BY created_at DESC"
    ).all() as Record<string, unknown>[];

    const items: MaterialLibItem[] = rows.map((row) => ({
      id: row.id as string,
      originalName: row.original_name as string,
      storedPath: row.stored_path as string,
      thumbnailPath: row.thumbnail_path as string | null,
      folderName: row.folder_name as string,
      duration: row.duration as number,
      width: row.width as number,
      height: row.height as number,
      fps: row.fps as number,
      codec: row.codec as string,
      bitrate: row.bitrate as number,
      size: row.size as number,
      createdAt: row.created_at as string,
    }));

    reply.send(items);
  });

  // ─── Upload material(s) ─────────────────────────────────

  app.post("/api/materials/upload", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "未选择文件" });

    const folderName = (data.fields.folderName as { value: string })?.value || "";
    await fs.promises.mkdir(config.uploadsDir, { recursive: true });

    const ext = path.extname(data.filename) || ".mp4";
    const fileId = nanoid(12);
    const storedName = `${fileId}${ext}`;
    const storedPathAbs = path.join(config.uploadsDir, storedName);

    await fs.promises.writeFile(storedPathAbs, await data.toBuffer());

    // Probe video
    let probeResult;
    try {
      probeResult = await probeVideo(storedPathAbs);
    } catch {
      probeResult = { duration: 0, width: 1920, height: 1080, fps: 30, codec: "unknown", bitrate: 0 };
    }

    const fileSize = (await fs.promises.stat(storedPathAbs)).size;

    // Generate thumbnail
    let thumbnailPath: string | null = null;
    try {
      const { generateThumbnail } = await import("../services/ffmpeg.js");
      const thumbDir = path.join(config.outputsDir, "thumbnails");
      await fs.promises.mkdir(thumbDir, { recursive: true });
      const thumbName = `${fileId}.jpg`;
      const thumbAbs = path.join(thumbDir, thumbName);
      await generateThumbnail(storedPathAbs, thumbAbs);
      thumbnailPath = `/api/materials-thumb/${thumbName}`;
    } catch {
      // Thumbnail is optional
    }

    db.prepare(
      `INSERT INTO materials (id, original_name, stored_path, thumbnail_path, folder_name, duration, width, height, fps, codec, bitrate, size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      fileId,
      data.filename,
      `/uploads/${storedName}`,
      thumbnailPath,
      folderName,
      probeResult.duration,
      probeResult.width,
      probeResult.height,
      probeResult.fps,
      probeResult.codec,
      probeResult.bitrate,
      fileSize,
    );

    reply.send({
      id: fileId,
      originalName: data.filename,
      storedPath: `/uploads/${storedName}`,
      thumbnailPath,
      folderName,
      duration: probeResult.duration,
      width: probeResult.width,
      height: probeResult.height,
    });
  });

  // ─── Delete material ────────────────────────────────────

  app.delete<{ Params: { id: string } }>("/api/materials/:id", async (req, reply) => {
    const { id } = req.params;
    const material = db.prepare("SELECT * FROM materials WHERE id = ?").get(id) as
      Record<string, unknown> | undefined;
    if (!material) return reply.status(404).send({ error: "素材不存在" });

    // Delete stored file
    const storedPath = (material.stored_path as string).replace("/uploads/", "");
    const absPath = path.join(config.uploadsDir, storedPath);
    try { await fs.promises.unlink(absPath); } catch { /* noop */ }

    // Delete thumbnail
    if (material.thumbnail_path) {
      const thumbPath = (material.thumbnail_path as string).replace("/thumbnails/", "");
      const absThumb = path.join(config.outputsDir, "thumbnails", thumbPath);
      try { await fs.promises.unlink(absThumb); } catch { /* noop */ }
    }

    db.prepare("DELETE FROM materials WHERE id = ?").run(id);

    reply.send({ ok: true });
  });
}
