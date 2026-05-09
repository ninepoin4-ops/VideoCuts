import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { config } from "../config.js";
import { probeVideo } from "../services/ffmpeg.js";
import { parseTextFile } from "../services/subtitle.js";
import type { SlotType } from "../types.js";

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // Upload video files into a slot group
  app.post("/api/upload/videos", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const slotType = (data.fields.slotType as { value: string })?.value || "middle";
    const groupName = (data.fields.groupName as { value: string })?.value || "default";

    // Create or reuse group
    let group = db.prepare(
      "SELECT id FROM slot_groups WHERE name = ? AND slot_type = ? LIMIT 1"
    ).get(groupName, slotType) as { id: string } | undefined;

    if (!group) {
      const groupId = nanoid(10);
      db.prepare(
        "INSERT INTO slot_groups (id, name, slot_type) VALUES (?, ?, ?)"
      ).run(groupId, groupName, slotType);
      group = { id: groupId };
    }

    // Save file
    const ext = path.extname(data.filename) || ".mp4";
    const fileId = nanoid(12);
    const storedName = `${fileId}${ext}`;
    const storedPath = path.join(config.uploadsDir, storedName);

    await fs.promises.mkdir(config.uploadsDir, { recursive: true });
    await fs.promises.writeFile(storedPath, await data.toBuffer());

    // Probe video
    let probeResult;
    try {
      probeResult = await probeVideo(storedPath);
    } catch {
      // If probe fails, store with defaults
      probeResult = {
        duration: 0,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: "unknown",
        bitrate: 0,
      };
    }

    const fileSize = (await fs.promises.stat(storedPath)).size;

    db.prepare(
      `INSERT INTO media_files (id, group_id, original_name, stored_path, duration, width, height, fps, codec, bitrate, size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      fileId,
      group.id,
      data.filename,
      storedPath,
      probeResult.duration,
      probeResult.width,
      probeResult.height,
      probeResult.fps,
      probeResult.codec,
      probeResult.bitrate,
      fileSize
    );

    reply.send({
      groupId: group.id,
      file: {
        id: fileId,
        originalName: data.filename,
        storedPath: `/uploads/${storedName}`,
        duration: probeResult.duration,
        width: probeResult.width,
        height: probeResult.height,
        fps: probeResult.fps,
        codec: probeResult.codec,
        bitrate: probeResult.bitrate,
        size: fileSize,
      },
    });
  });

  // Upload folder of videos (multiple files with grouping)
  app.post("/api/upload/folder", async (req, reply) => {
    const parts = req.parts();
    const groupMap = new Map<string, { slotType: SlotType; files: { originalName: string; buffer: Buffer }[] }>();

    for await (const part of parts) {
      if (part.type === "file") {
        const slotType = (part.fields.slotType as { value: string })?.value || "middle";
        // Folder name becomes group name (using parent dir of filename)
        const groupName = (part.fields.groupName as { value: string })?.value || path.basename(path.dirname(part.filename)) || "default";

        if (!groupMap.has(groupName)) {
          groupMap.set(groupName, { slotType: slotType as SlotType, files: [] });
        }
        groupMap.get(groupName)!.files.push({
          originalName: part.filename,
          buffer: await part.toBuffer(),
        });
      }
    }

    const results: { groupId: string; files: { id: string; originalName: string }[] }[] = [];

    for (const [groupName, { slotType, files }] of groupMap) {
      const groupId = nanoid(10);
      db.prepare(
        "INSERT INTO slot_groups (id, name, slot_type) VALUES (?, ?, ?)"
      ).run(groupId, groupName, slotType);

      const uploadedFiles = [];

      for (const file of files) {
        const ext = path.extname(file.originalName) || ".mp4";
        const fileId = nanoid(12);
        const storedName = `${fileId}${ext}`;
        const storedPath = path.join(config.uploadsDir, storedName);

        await fs.promises.writeFile(storedPath, file.buffer);

        let probeResult;
        try {
          probeResult = await probeVideo(storedPath);
        } catch {
          probeResult = { duration: 0, width: 1920, height: 1080, fps: 30, codec: "unknown", bitrate: 0 };
        }

        const fileSize = fs.statSync(storedPath).size;

        db.prepare(
          `INSERT INTO media_files (id, group_id, original_name, stored_path, duration, width, height, fps, codec, bitrate, size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(fileId, groupId, file.originalName, storedPath, probeResult.duration, probeResult.width, probeResult.height, probeResult.fps, probeResult.codec, probeResult.bitrate, fileSize);

        uploadedFiles.push({ id: fileId, originalName: file.originalName });
      }

      results.push({ groupId, files: uploadedFiles });
    }

    reply.send({ groups: results });
  });

  // Upload BGM file
  app.post("/api/upload/bgm", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const ext = path.extname(data.filename) || ".mp3";
    const storedName = `bgm_${nanoid(12)}${ext}`;
    const storedPath = path.join(config.uploadsDir, storedName);

    await fs.promises.writeFile(storedPath, await data.toBuffer());

    reply.send({
      path: `/uploads/${storedName}`,
      originalName: data.filename,
    });
  });

  // Upload text file (Excel/CSV)
  app.post("/api/upload/texts", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const ext = path.extname(data.filename) || ".csv";
    const storedName = `text_${nanoid(12)}${ext}`;
    const storedPath = path.join(config.uploadsDir, storedName);

    await fs.promises.writeFile(storedPath, await data.toBuffer());

    try {
      const parsed = parseTextFile(storedPath, data.filename);

      // Convert to caption texts
      const texts = parsed.rows.map((row, i) => {
        // Use first column as template, rest as variables
        const keys = parsed.headers;
        const template = keys.length > 0 ? row[keys[0]] : `Line ${i + 1}`;

        const variables: Record<string, string> = {};
        for (const key of keys) {
          variables[key] = row[key] || "";
        }

        return {
          id: nanoid(8),
          template,
          variables,
        };
      });

      reply.send({
        headers: parsed.headers,
        rowCount: parsed.rowCount,
        texts,
        filePath: `/uploads/${storedName}`,
      });
    } catch (err) {
      reply.status(400).send({ error: err instanceof Error ? err.message : "Failed to parse file" });
    }
  });

  // List groups
  app.get("/api/groups", async (_req, reply) => {
    const groups = db.prepare(
      `SELECT sg.*, COUNT(mf.id) as file_count
       FROM slot_groups sg
       LEFT JOIN media_files mf ON mf.group_id = sg.id
       GROUP BY sg.id
       ORDER BY sg.created_at DESC`
    ).all();

    reply.send(groups);
  });

  // List files in a group
  app.get<{ Params: { groupId: string } }>(
    "/api/groups/:groupId/files",
    async (req, reply) => {
      const files = db.prepare(
        "SELECT * FROM media_files WHERE group_id = ? ORDER BY created_at ASC"
      ).all(req.params.groupId);

      reply.send(files);
    }
  );

  // Delete group
  app.delete<{ Params: { groupId: string } }>(
    "/api/groups/:groupId",
    async (req, reply) => {
      db.prepare("DELETE FROM slot_groups WHERE id = ?").run(req.params.groupId);
      reply.send({ ok: true });
    }
  );
}
