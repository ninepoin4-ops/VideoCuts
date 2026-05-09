import { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { taskQueue } from "../services/queue.js";
import { retrySingleRender } from "../services/mixer.js";
import type { TaskItem, CreateTaskRequest, TaskConfig } from "../types.js";

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  // Create a new task
  app.post<{ Body: CreateTaskRequest }>("/api/tasks", async (req, reply) => {
    const body = req.body;
    const id = nanoid(12);

    const taskConfig: TaskConfig = {
      mode: body.mode || "free",
      templateId: body.templateId || undefined,
      groups: [],
      transitionType: body.transitionType || "fade",
      transitionDuration: body.transitionDuration || 0.5,
      texts: body.texts || [],
      addSubtitles: body.addSubtitles ?? false,
      bgmPath: body.bgmPath || null,
      bgmVolume: body.bgmVolume ?? 0.3,
      ttsEnabled: body.ttsEnabled ?? false,
      ttsVolume: body.ttsVolume ?? 0.7,
      bgmDuckOnSpeech: body.bgmDuckOnSpeech ?? true,
      speechGap: body.speechGap ?? 0.5,
      count: Math.min(Math.max(body.count || 1, 1), 100),
      outputFormat: "mp4",
      minSegmentDuration: body.minSegmentDuration || 2,
      maxSegmentDuration: body.maxSegmentDuration || 8,
    };

    db.prepare(
      `INSERT INTO tasks (id, name, status, total_count, config_json)
       VALUES (?, ?, 'pending', ?, ?)`
    ).run(id, body.name || "Untitled", taskConfig.count, JSON.stringify(taskConfig));

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown>;

    reply.status(201).send({
      id: task.id,
      name: task.name,
      status: task.status,
      totalCount: task.total_count,
      completedCount: task.completed_count,
      failedCount: task.failed_count,
      queuePosition: task.queue_position,
      createdAt: task.created_at,
      config: JSON.parse(task.config_json as string),
    });
  });

  // List all tasks
  app.get("/api/tasks", async (_req, reply) => {
    const rows = db
      .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
      .all() as Record<string, unknown>[];

    reply.send(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        totalCount: row.total_count,
        completedCount: row.completed_count,
        failedCount: row.failed_count,
        queuePosition: row.queue_position,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        error: row.error,
        config: JSON.parse(row.config_json as string),
      }))
    );
  });

  // Get single task
  app.get<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return reply.status(404).send({ error: "Task not found" });

    reply.send({
      id: row.id,
      name: row.name,
      status: row.status,
      totalCount: row.total_count,
      completedCount: row.completed_count,
      failedCount: row.failed_count,
      queuePosition: row.queue_position,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
      config: JSON.parse(row.config_json as string),
      results: JSON.parse(row.results_json as string),
    });
  });

  // Start task (enqueue)
  app.post<{ Params: { id: string } }>("/api/tasks/:id/start", async (req, reply) => {
    const { id } = req.params;
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!task) return reply.status(404).send({ error: "Task not found" });

    const taskConfig = JSON.parse(task.config_json as string) as TaskConfig;

    if (taskConfig.mode === "template") {
      // Template mode: attach template info to config
      if (taskConfig.templateId) {
        const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(taskConfig.templateId) as Record<string, unknown> | undefined;
        if (template) {
          const segments = db.prepare(
            "SELECT * FROM template_segments WHERE template_id = ? ORDER BY seg_index"
          ).all(taskConfig.templateId) as Record<string, unknown>[];
          taskConfig.groups = []; // clear groups, use template
        }
      }
    } else {
      // Free mode: attach available groups to task config
      const groups = db.prepare(
        `SELECT sg.*, 
          (SELECT json_group_array(
            json_object(
              'id', mf.id,
              'originalName', mf.original_name,
              'storedPath', mf.stored_path,
              'duration', mf.duration,
              'width', mf.width,
              'height', mf.height,
              'fps', mf.fps,
              'codec', mf.codec,
              'bitrate', mf.bitrate,
              'size', mf.size
            )
          ) FROM media_files mf WHERE mf.group_id = sg.id) as files_json
         FROM slot_groups sg`
      ).all() as { id: string; name: string; slot_type: string; files_json: string }[];

      taskConfig.groups = groups.map((g) => ({
        id: g.id,
        name: g.name,
        slotType: g.slot_type as "opening" | "middle" | "ending",
        files: JSON.parse(g.files_json || "[]"),
      }));
    }

    db.prepare("UPDATE tasks SET config_json = ? WHERE id = ?")
      .run(JSON.stringify(taskConfig), id);

    await taskQueue.enqueue(id);

    reply.send({ ok: true, queuePosition: 0 });
  });

  // Get task results
  app.get<{ Params: { id: string } }>("/api/tasks/:id/results", async (req, reply) => {
    const row = db.prepare("SELECT results_json FROM tasks WHERE id = ?").get(req.params.id) as { results_json: string } | undefined;
    if (!row) return reply.status(404).send({ error: "Task not found" });

    reply.send(JSON.parse(row.results_json));
  });

  // Retry failed render
  app.post<{ Params: { id: string; index: string } }>(
    "/api/tasks/:id/results/:index/retry",
    async (req, reply) => {
      const { id, index } = req.params;
      const result = await retrySingleRender(id, Number(index));
      reply.send(result);
    }
  );

  // Delete task
  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    const { id } = req.params;
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    reply.send({ ok: true });
  });

  // Get queue status
  app.get("/api/queue", async (_req, reply) => {
    const positions = taskQueue.getQueuePositions();
    const queueLength = taskQueue.getQueueLength();

    reply.send({
      queueLength,
      isProcessing: taskQueue.isProcessing(),
      positions: Array.from(positions.entries()).map(([taskId, pos]) => ({
        taskId,
        queuePosition: pos,
      })),
    });
  });
}
