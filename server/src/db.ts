import Database from "better-sqlite3";
import { config } from "./config.js";
import fs from "fs";
import path from "path";

// Ensure data directories exist
for (const dir of [config.dataDir, config.uploadsDir, config.outputsDir, config.cacheDir, path.dirname(config.dbPath)]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const _db = new Database(config.dbPath);

// WAL mode for better concurrent reads
_db.pragma("journal_mode = WAL");
_db.pragma("foreign_keys = ON");

// ─── Schema ─────────────────────────────────────────────────

_db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    queue_position INTEGER NOT NULL DEFAULT -1,
    created_by TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    config_json TEXT NOT NULL DEFAULT '{}',
    results_json TEXT NOT NULL DEFAULT '[]',
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS slot_groups (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    name TEXT NOT NULL,
    slot_type TEXT NOT NULL DEFAULT 'middle',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    duration REAL NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    fps REAL NOT NULL DEFAULT 0,
    codec TEXT NOT NULL DEFAULT '',
    bitrate INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES slot_groups(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(queue_position);
  CREATE INDEX IF NOT EXISTS idx_media_files_group ON media_files(group_id);

  -- ─── Template System ──────────────────────────────────────

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_duration REAL NOT NULL DEFAULT 0,
    subtitle_enabled INTEGER NOT NULL DEFAULT 0,
    subtitle_style_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS template_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT NOT NULL,
    seg_index INTEGER NOT NULL,
    duration REAL NOT NULL,
    transition_type TEXT NOT NULL DEFAULT 'fade',
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_template_segments_template ON template_segments(template_id);

  -- ─── Material Library ─────────────────────────────────────

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    thumbnail_path TEXT,
    folder_name TEXT NOT NULL DEFAULT '',
    duration REAL NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    fps REAL NOT NULL DEFAULT 0,
    codec TEXT NOT NULL DEFAULT '',
    bitrate INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_materials_folder ON materials(folder_name);
`);

// ─── Default template ─────────────────────────────────────

// Create default template (16s = 4×4s, dissolve-fade-dissolve) if no templates exist
const templateCount = _db.prepare("SELECT COUNT(*) as cnt FROM templates").get() as { cnt: number };
if (templateCount.cnt === 0) {
  const defaultId = "tmpl_default";
  _db.prepare(
    "INSERT INTO templates (id, name, total_duration, subtitle_enabled, subtitle_style_json) VALUES (?, ?, ?, ?, ?)"
  ).run(defaultId, "默认模板 (16秒)", 16, 0, JSON.stringify({
    position: "bottom",
    fontFamily: "Arial",
    fontSize: 24,
    fontColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 1,
    animation: "fade-in",
  }));

  const insertSeg = _db.prepare(
    "INSERT INTO template_segments (template_id, seg_index, duration, transition_type) VALUES (?, ?, ?, ?)"
  );
  // 4 segments of 4s each
  insertSeg.run(defaultId, 0, 4, "dissolve");
  insertSeg.run(defaultId, 1, 4, "fade");
  insertSeg.run(defaultId, 2, 4, "dissolve");
  insertSeg.run(defaultId, 3, 4, "fade"); // last transition is unused but stored for consistency
}

export const db = _db;
