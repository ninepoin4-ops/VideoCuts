import path from "path";
import { nanoid } from "nanoid";
import { promises as fsPromises, existsSync, mkdirSync } from "fs";
const fsPromisesCopy = fsPromises.copyFile;
const fsPromisesMkdir = fsPromises.mkdir;
const fsPromisesUnlink = fsPromises.unlink;
import { db } from "../db.js";
import { config } from "../config.js";
import type {
  TaskItem,
  TaskConfig,
  TaskProgressPayload,
  RenderResult,
  VideoSegment,
  SlotGroup,
  MediaFile,
  MaterialLibItem,
  SlotType,
  Template,
  TemplateSegment,
} from "../types.js";
import * as ffmpeg from "./ffmpeg.js";

// ─── Pick random segment ────────────────────────────────────

function pickSegment(
  file: MediaFile,
  minDuration: number,
  maxDuration: number
): { startTime: number; duration: number } {
  const availableDuration = file.duration;
  const maxPossible = Math.min(availableDuration, maxDuration);
  const minPossible = Math.min(availableDuration, minDuration);

  if (minPossible >= maxPossible) {
    return { startTime: 0, duration: availableDuration };
  }

  const dur = minPossible + Math.random() * (maxPossible - minPossible);
  const maxStart = Math.max(0, availableDuration - dur);
  const startTime = Math.random() * maxStart;

  return { startTime, duration: dur };
}

// ─── Build video plan (free mode) ───────────────────────────

interface VideoPlan {
  segments: VideoSegment[];
  totalDuration: number;
}

function buildVideoPlan(
  taskConfig: TaskConfig,
  index: number
): VideoPlan {
  const segments: VideoSegment[] = [];
  const usedFiles = new Set<string>();
  let totalDuration = 0;

  const slotOrder: SlotType[] = ["opening", "middle", "ending"];

  for (const slot of slotOrder) {
    const groups = taskConfig.groups.filter((g) => g.slotType === slot);
    if (groups.length === 0) continue;

    const group = groups[Math.floor(Math.random() * groups.length)];
    const middleCount = slot === "middle" ? 1 + Math.floor(Math.random() * 3) : 1;

    for (let m = 0; m < middleCount; m++) {
      let available = group.files.filter((f) => !usedFiles.has(f.id));
      if (available.length === 0) {
        available = group.files;
        usedFiles.clear();
      }

      const file = available[Math.floor(Math.random() * available.length)];
      usedFiles.add(file.id);

      const { startTime, duration } = pickSegment(
        file,
        taskConfig.minSegmentDuration,
        taskConfig.maxSegmentDuration
      );

      segments.push({
        fileId: file.id,
        sourcePath: file.storedPath,
        startTime,
        duration,
        slotType: slot,
      });

      totalDuration += duration;
    }
  }

  return { segments, totalDuration };
}

// ─── Build video plan (template mode) ───────────────────────

async function buildTemplatePlan(
  taskConfig: TaskConfig
): Promise<VideoPlan> {
  const segments: VideoSegment[] = [];
  let totalDuration = 0;

  if (!taskConfig.templateId) throw new Error("模板未指定");

  // Fetch template
  const templateRow = db.prepare("SELECT * FROM templates WHERE id = ?").get(taskConfig.templateId) as
    Record<string, unknown> | undefined;
  if (!templateRow) throw new Error("模板不存在");

  const templateSegments = db.prepare(
    "SELECT * FROM template_segments WHERE template_id = ? ORDER BY seg_index"
  ).all(taskConfig.templateId) as Record<string, unknown>[];

  // Fetch all materials from library (map snake_case DB columns to camelCase)
  const rawMaterials = db.prepare(
    "SELECT * FROM materials ORDER BY RANDOM()"
  ).all() as Record<string, unknown>[];

  const materials: MaterialLibItem[] = rawMaterials.map((row) => ({
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
  })).filter((m) => m.duration > 0); // Skip zero-duration (failed probe) materials

  if (materials.length === 0) {
    throw new Error("素材库为空，请先上传素材到素材库");
  }

  const usedFiles = new Set<string>();
  const fileIdCounter = { value: 0 };

  for (const tplSeg of templateSegments) {
    const segDuration = tplSeg.duration as number;

    // Pick a random material not yet used in this video
    let available = materials.filter((m) => !usedFiles.has(m.id));
    if (available.length === 0) {
      available = materials;
      usedFiles.clear();
    }

    const mat = available[Math.floor(Math.random() * available.length)];
    usedFiles.add(mat.id);

    const absPath = path.join(config.uploadsDir, path.basename(mat.storedPath));

    // Adaptation rules
    const adapted = adaptMaterial(mat, segDuration);

    segments.push({
      fileId: mat.id,
      sourcePath: absPath,
      startTime: adapted.startTime,
      duration: segDuration,  // target duration
      slotType: "middle",
      needsStretch: adapted.needsStretch,
      stretchFactor: adapted.stretchFactor,
    });

    totalDuration += segDuration;
  }

  return { segments, totalDuration };
}

// ─── Material adaptation ────────────────────────────────────

function adaptMaterial(
  mat: MaterialLibItem,
  targetDuration: number
): { startTime: number; needsStretch: boolean; stretchFactor: number } {
  const videoDuration = mat.duration;

  if (videoDuration <= 0) {
    throw new Error(
      `素材 "${mat.originalName}" 时长异常 (${videoDuration}秒)，可能是视频文件损坏或格式不兼容，请重新上传`
    );
  }

  if (videoDuration >= targetDuration) {
    // Video longer than segment → trim tail
    const maxStart = videoDuration - targetDuration;
    const startTime = Math.random() * maxStart;
    return { startTime, needsStretch: false, stretchFactor: 1 };
  } else {
    // Video shorter than segment → time-stretch to fill
    const stretchFactor = targetDuration / videoDuration;
    return { startTime: 0, needsStretch: true, stretchFactor };
  }
}

// ─── Process sub-video ──────────────────────────────────────

async function renderSingleVideo(
  taskId: string,
  plan: VideoPlan,
  taskConfig: TaskConfig,
  index: number,
  text: string | null
): Promise<RenderResult> {
  const taskOutputDir = path.join(config.outputsDir, taskId);
  const taskCacheDir = path.join(config.cacheDir, taskId);
  await fsPromisesMkdir(taskOutputDir, { recursive: true });
  await fsPromisesMkdir(taskCacheDir, { recursive: true });

  const result: RenderResult = {
    index,
    outputPath: "",
    thumbnailPath: null,
    status: "rendering",
    error: null,
    duration: null,
    config: {
      segments: plan.segments,
      transition: taskConfig.transitionType,
      transitionDuration: taskConfig.transitionDuration,
      text,
    },
  };

  try {
    // Step 0: Determine target resolution from first source video (normalize all segments)
    const firstSeg = plan.segments[0];
    const probe = await ffmpeg.probeVideo(firstSeg.sourcePath);
    const targetW = probe.width || 1920;
    const targetH = probe.height || 1080;
    const targetFps = probe.fps || 30;

    // Step 1: Extract and adapt segments (all normalized to same resolution)
    const segmentPaths: { path: string; duration: number }[] = [];
    for (let s = 0; s < plan.segments.length; s++) {
      const seg = plan.segments[s];
      const segPath = path.join(taskCacheDir, `seg_${index}_${s}.mp4`);

      if (seg.needsStretch && seg.stretchFactor && seg.stretchFactor > 1) {
        const rawPath = path.join(taskCacheDir, `seg_${index}_${s}_raw.mp4`);
        await ffmpeg.extractSegment(seg.sourcePath, rawPath, 0, seg.duration / seg.stretchFactor, targetW, targetH);
        await ffmpeg.timeStretchVideo(rawPath, segPath, seg.stretchFactor);
        try { await fsPromisesUnlink(rawPath); } catch { /* noop */ }
      } else {
        await ffmpeg.extractSegment(seg.sourcePath, segPath, seg.startTime, seg.duration, targetW, targetH);
      }
      
      // Probe actual duration of the extracted segment (encodes can be slightly off)
      let actualDuration = seg.duration;
      try {
        actualDuration = await ffmpeg.getDuration(segPath);
      } catch { /* use target duration as fallback */ }
      
      segmentPaths.push({ path: segPath, duration: actualDuration || seg.duration });
    }

    // Step 2: Concatenate with transitions (width/height passed for scale normalization)
    const concatPath = path.join(taskCacheDir, `concat_${index}.mp4`);
    const transitions = getTransitionSequence(taskConfig, plan.segments.length);

    await ffmpeg.concatWithTransitionSequence(
      segmentPaths,
      concatPath,
      transitions,
      targetW,
      targetH,
      targetFps
    );

    let videoPath = concatPath;

    // Step 5: Add text overlay if needed
    if (text) {
      const textPath = path.join(taskCacheDir, `text_${index}.mp4`);
      await ffmpeg.addTextOverlay(videoPath, text, textPath);
      videoPath = textPath;
    }

    // Step 6: Add BGM if specified
    if (taskConfig.bgmPath) {
      const bgmPath = path.join(taskCacheDir, `bgm_${index}.mp4`);
      const videoDuration = await ffmpeg.getDuration(videoPath);
      await ffmpeg.mixAudio(videoPath, taskConfig.bgmPath, bgmPath, taskConfig.bgmVolume, videoDuration);
      videoPath = bgmPath;
    }

    // Step 7: Copy to final output
    const outputName = `mix_${String(index + 1).padStart(3, "0")}.mp4`;
    const finalPath = path.join(taskOutputDir, outputName);
    await fsPromisesCopy(videoPath, finalPath);

    // Step 8: Generate thumbnail
    const thumbName = `thumb_${String(index + 1).padStart(3, "0")}.jpg`;
    const thumbPath = path.join(taskOutputDir, thumbName);
    try {
      await ffmpeg.generateThumbnail(finalPath, thumbPath);
      result.thumbnailPath = `/outputs/${taskId}/${thumbName}`;
    } catch {
      // Thumbnail is optional
    }

    result.outputPath = `/outputs/${taskId}/${outputName}`;
    result.status = "completed";
    result.duration = await ffmpeg.getDuration(finalPath);

    // Clean up cache files
    for (const sp of segmentPaths) {
      try { await fsPromisesUnlink(sp.path); } catch { /* noop */ }
    }
  } catch (err) {
    result.status = "failed";
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// ─── Transition sequence helper ─────────────────────────────

function getTransitionSequence(
  taskConfig: TaskConfig,
  segmentCount: number
): { type: import("../types.js").TransitionType; duration: number }[] {
  if (taskConfig.mode === "template" && taskConfig.templateId) {
    // Fetch per-segment transitions from template
    const templateSegs = db.prepare(
      "SELECT * FROM template_segments WHERE template_id = ? ORDER BY seg_index"
    ).all(taskConfig.templateId) as Record<string, unknown>[];
    
    // Use all segments except the last one (transition is between segments)
    // templateSegs: [seg0(t0), seg1(t1), seg2(t2), seg3(t3)]
    // We want transitions: t0(between 0-1), t1(between 1-2), t2(between 2-3)
    // So slice(0, -1) drops the last segment (t3 is unused)
    return templateSegs.slice(0, -1).map((seg) => ({
      type: seg.transition_type as import("../types.js").TransitionType,
      duration: taskConfig.transitionDuration,
    }));
  }

  // Free mode: same transition for all cuts
  const result: { type: import("../types.js").TransitionType; duration: number }[] = [];
  for (let i = 1; i < segmentCount; i++) {
    result.push({ type: taskConfig.transitionType, duration: taskConfig.transitionDuration });
  }
  return result;
}

// ─── Process entire task ────────────────────────────────────

type ProgressCb = (progress: TaskProgressPayload) => void;

export async function processTask(
  taskId: string,
  onProgress: ProgressCb
): Promise<void> {
  const row = db.prepare("SELECT config_json, total_count FROM tasks WHERE id = ?").get(taskId) as {
    config_json: string;
    total_count: number;
  } | undefined;
  if (!row) throw new Error(`Task ${taskId} not found`);

  const taskConfig: TaskConfig = JSON.parse(row.config_json);
  let completed = 0;
  let failed = 0;
  const results: RenderResult[] = [];

  for (let i = 0; i < taskConfig.count; i++) {
    let plan: VideoPlan;

    if (taskConfig.mode === "template") {
      plan = await buildTemplatePlan(taskConfig);
    } else {
      plan = buildVideoPlan(taskConfig, i);
    }

    if (plan.segments.length === 0) {
      failed++;
      results.push({
        index: i,
        outputPath: "",
        thumbnailPath: null,
        status: "failed",
        error: "No segments to mix",
        duration: null,
        config: { segments: [], transition: taskConfig.transitionType, transitionDuration: taskConfig.transitionDuration, text: null },
      });
      continue;
    }

    // Pick text for this video
    let text: string | null = null;
    if (taskConfig.texts.length > 0) {
      const textItem = taskConfig.texts[i % taskConfig.texts.length];
      const { substituteVariables } = await import("./subtitle.js");
      text = substituteVariables(textItem.template, textItem.variables || {});
    }

    const result = await renderSingleVideo(taskId, plan, taskConfig, i, text);
    results.push(result);

    if (result.status === "completed") completed++;
    else failed++;

    onProgress({
      taskId,
      status: "processing",
      completedCount: completed,
      totalCount: taskConfig.count,
      failedCount: failed,
      queuePosition: 0,
      currentRender: result,
      results: [...results],
    });
  }
}

// ─── Retry single render ────────────────────────────────────

export async function retrySingleRender(
  taskId: string,
  renderIndex: number
): Promise<RenderResult> {
  const row = db.prepare("SELECT config_json, results_json FROM tasks WHERE id = ?").get(taskId) as {
    config_json: string;
    results_json: string;
  } | undefined;
  if (!row) throw new Error(`Task ${taskId} not found`);

  const taskConfig: TaskConfig = JSON.parse(row.config_json);
  let plan: VideoPlan;
  if (taskConfig.mode === "template") {
    plan = await buildTemplatePlan(taskConfig);
  } else {
    plan = buildVideoPlan(taskConfig, renderIndex);
  }

  let text: string | null = null;
  if (taskConfig.texts.length > 0) {
    const textItem = taskConfig.texts[renderIndex % taskConfig.texts.length];
    const { substituteVariables } = await import("./subtitle.js");
    text = substituteVariables(textItem.template, textItem.variables || {});
  }

  return renderSingleVideo(taskId, plan, taskConfig, renderIndex, text);
}
