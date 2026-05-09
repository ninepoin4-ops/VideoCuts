import { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import type {
  Template,
  TemplateSegment,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from "../types.js";

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  // ─── List all templates ─────────────────────────────────

  app.get("/api/templates", async (_req, reply) => {
    const rows = db.prepare(
      "SELECT * FROM templates ORDER BY created_at DESC"
    ).all() as Record<string, unknown>[];

    const templates: Template[] = rows.map((row) => {
      const segments = db.prepare(
        "SELECT * FROM template_segments WHERE template_id = ? ORDER BY seg_index"
      ).all(row.id as string) as Record<string, unknown>[];

      return {
        id: row.id as string,
        name: row.name as string,
        totalDuration: row.total_duration as number,
        segments: segments.map((seg) => ({
          index: seg.seg_index as number,
          duration: seg.duration as number,
          transitionType: seg.transition_type as TemplateSegment["transitionType"],
        })),
        subtitleEnabled: Boolean(row.subtitle_enabled),
        subtitleStyle: JSON.parse(row.subtitle_style_json as string),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    });

    reply.send(templates);
  });

  // ─── Get single template ────────────────────────────────

  app.get<{ Params: { id: string } }>("/api/templates/:id", async (req, reply) => {
    const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id) as
      Record<string, unknown> | undefined;
    if (!row) return reply.status(404).send({ error: "模板不存在" });

    const segments = db.prepare(
      "SELECT * FROM template_segments WHERE template_id = ? ORDER BY seg_index"
    ).all(req.params.id) as Record<string, unknown>[];

    reply.send({
      id: row.id as string,
      name: row.name as string,
      totalDuration: row.total_duration as number,
      segments: segments.map((seg) => ({
        index: seg.seg_index as number,
        duration: seg.duration as number,
        transitionType: seg.transition_type as TemplateSegment["transitionType"],
      })),
      subtitleEnabled: Boolean(row.subtitle_enabled),
      subtitleStyle: JSON.parse(row.subtitle_style_json as string),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  });

  // ─── Create template ────────────────────────────────────

  app.post<{ Body: CreateTemplateRequest }>("/api/templates", async (req, reply) => {
    const body = req.body;
    if (!body.name || !body.segments || body.segments.length === 0) {
      return reply.status(400).send({ error: "名称和分段不能为空" });
    }

    const id = nanoid(10);
    const totalDuration = body.segments.reduce((sum, s) => sum + s.duration, 0);

    db.prepare(
      `INSERT INTO templates (id, name, total_duration, subtitle_enabled, subtitle_style_json)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      id,
      body.name,
      totalDuration,
      body.subtitleEnabled ? 1 : 0,
      JSON.stringify(body.subtitleStyle || {
        position: "bottom",
        fontFamily: "Arial",
        fontSize: 24,
        fontColor: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 1,
        animation: "fade-in",
      })
    );

    const insertSeg = db.prepare(
      "INSERT INTO template_segments (template_id, seg_index, duration, transition_type) VALUES (?, ?, ?, ?)"
    );
    body.segments.forEach((seg, i) => {
      insertSeg.run(id, i, seg.duration, seg.transitionType);
    });

    reply.status(201).send({ id, totalDuration });
  });

  // ─── Update template ────────────────────────────────────

  app.put<{ Params: { id: string }; Body: UpdateTemplateRequest }>(
    "/api/templates/:id",
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body;

      const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as
        Record<string, unknown> | undefined;
      if (!existing) return reply.status(404).send({ error: "模板不存在" });

      if (body.name) {
        db.prepare("UPDATE templates SET name = ? WHERE id = ?").run(body.name, id);
      }

      if (body.segments) {
        const totalDuration = body.segments.reduce((sum, s) => sum + s.duration, 0);
        db.prepare("DELETE FROM template_segments WHERE template_id = ?").run(id);
        const insertSeg = db.prepare(
          "INSERT INTO template_segments (template_id, seg_index, duration, transition_type) VALUES (?, ?, ?, ?)"
        );
        body.segments.forEach((seg, i) => {
          insertSeg.run(id, i, seg.duration, seg.transitionType);
        });
        db.prepare("UPDATE templates SET total_duration = ? WHERE id = ?").run(totalDuration, id);
      }

      if (body.subtitleEnabled !== undefined || body.subtitleStyle) {
        const subtitleEnabled = body.subtitleEnabled !== undefined ? body.subtitleEnabled : Boolean(existing.subtitle_enabled);
        const style = body.subtitleStyle || JSON.parse(existing.subtitle_style_json as string);
        db.prepare(
          "UPDATE templates SET subtitle_enabled = ?, subtitle_style_json = ? WHERE id = ?"
        ).run(subtitleEnabled ? 1 : 0, JSON.stringify(style), id);
      }

      db.prepare("UPDATE templates SET updated_at = datetime('now') WHERE id = ?").run(id);

      reply.send({ ok: true });
    }
  );

  // ─── Delete template ────────────────────────────────────

  app.delete<{ Params: { id: string } }>("/api/templates/:id", async (req, reply) => {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as
      Record<string, unknown> | undefined;
    if (!existing) return reply.status(404).send({ error: "模板不存在" });

    // Prevent deleting default template
    if (id === "tmpl_default") {
      return reply.status(400).send({ error: "默认模板不可删除" });
    }

    db.prepare("DELETE FROM template_segments WHERE template_id = ?").run(id);
    db.prepare("DELETE FROM templates WHERE id = ?").run(id);

    reply.send({ ok: true });
  });
}
