import { spawn, execFile } from "child_process";
import path from "path";
import fs from "fs";
import { config } from "../config.js";
import type { TransitionType } from "../types.js";

// ─── Probe ──────────────────────────────────────────────────

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
}

function parseFps(fpsStr: string): number {
  const parts = fpsStr.split("/");
  return parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(parts[0]);
}

export function probeVideo(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    execFile(
      config.ffprobePath,
      [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { maxBuffer: 1024 * 1024 * 10 },
      (err, stdout) => {
        if (err) return reject(err);
        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
          const audioStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");
          const format = data.format || {};
          resolve({
            duration: Number(format.duration) || Number(videoStream?.duration) || 0,
            width: Number(videoStream?.width) || 0,
            height: Number(videoStream?.height) || 0,
            fps: videoStream?.r_frame_rate ? parseFps(videoStream.r_frame_rate) : 0,
            codec: videoStream?.codec_name || "",
            bitrate: Number(format.bit_rate) || 0,
          });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// ─── FFMpeg Runner ──────────────────────────────────────────

function runFFmpeg(args: string[], onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(config.ffmpegPath, [
      "-hide_banner",
      "-nostdin",
      "-y",
      ...args,
    ]);
    let stderr = "";

    ffmpeg.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress from "time=XX:XX:XX.XX" in stderr
      if (onProgress) {
        const match = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (match) {
          const hours = Number(match[1]);
          const mins = Number(match[2]);
          const secs = Number(match[3]);
          const total = hours * 3600 + mins * 60 + secs;
          onProgress(total);
        }
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    ffmpeg.on("error", (err) => reject(err));
  });
}

// ─── Segment to file ────────────────────────────────────────

export async function extractSegment(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  targetWidth?: number,
  targetHeight?: number
): Promise<void> {
  const args: string[] = [
    "-ss", String(startTime),
    "-i", inputPath,
    "-t", String(duration),
  ];

  // Add scale filter if target resolution specified, enforcing square pixels
  if (targetWidth && targetHeight) {
    args.push(
      "-vf", `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
    );
  }

  args.push(
    "-c:v", config.videoCodec,
    "-crf", String(config.crf),
    "-preset", "medium",
    "-c:a", "aac",
    "-b:a", "192k",
    "-avoid_negative_ts", "make_zero",
    outputPath,
  );

  await runFFmpeg(args);
}

// ─── Generate thumbnail ─────────────────────────────────────

export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timeSeconds = 1
): Promise<void> {
  await runFFmpeg([
    "-ss", String(timeSeconds),
    "-i", videoPath,
    "-vframes", "1",
    "-q:v", "2",
    "-vf", "scale=480:-1",
    outputPath,
  ]);
}

// ─── Transition name mapping (for xfade) ──────────────────

/** Returns the xfade-compatible transition name. */
function getXfadeTransition(type: TransitionType): string {
  switch (type) {
    case "fade":          return "fade";
    case "dissolve":      return "fade";
    case "flash-white":   return "fadewhite";
    case "flash-black":   return "fadeblack";
    case "wipe-left":     return "wipeleft";
    case "wipe-right":    return "wiperight";
    case "wipe-up":       return "wipeup";
    case "wipe-down":     return "wipedown";
    case "diagonal-cut":  return "diagtl";
    case "circle-open":   return "radial";
    case "rect-mask":     return "horzopen";
    case "zoom-punch":    return "smoothup";     // closest approximation
    case "blur":          return "hblur";
    case "pixelate":      return "pixelize";
    case "glitch":        return "pixelize";     // approximation: pixelize
    case "page-curl":     return "coverleft";    // approximation
    case "blinds":        return "horzopen";     // approximation
    case "spin-in":       return "smoothleft";   // approximation
    case "spin-out":      return "smoothright";  // approximation
    case "shake-in":      return "distance";     // approximation
    case "soft-light":    return "fade";
    case "jump-cut":      return "fade";         // very short duration → looks like cut
    default:              return "fade";
  }
}

// ─── Concatenate with transitions ───────────────────────────

export async function concatWithTransitions(
  inputFiles: { path: string; duration: number }[],
  outputPath: string,
  transitionType: TransitionType,
  transitionDuration: number,
  width: number,
  height: number,
  fps: number,
  onProgress?: (pct: number) => void
): Promise<void> {
  if (inputFiles.length === 0) throw new Error("No input files for concatenation");
  if (inputFiles.length === 1) {
    // Single file - copy directly
    await fs.promises.copyFile(inputFiles[0].path, outputPath);
    return;
  }

  const xfadeName = getXfadeTransition(transitionType);
  const filterParts: string[] = [];
  let lastLabel = "v0";
  let accumulatedDuration = 0; // Track running output duration for correct xfade offset

  for (let i = 0; i < inputFiles.length; i++) {
    // Normalize each segment: setpts + scale to target resolution
    filterParts.push(
      `[${i}:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`
    );

    if (i > 0) {
      const outLabel = i === inputFiles.length - 1 ? "vout" : `vtemp${i}`;
      // offset = accumulated duration so far - transition duration
      const offset = accumulatedDuration - transitionDuration;
      filterParts.push(
        `[${lastLabel}][v${i}]xfade=transition=${xfadeName}:duration=${transitionDuration}:offset=${offset}[${outLabel}];`
      );
      lastLabel = outLabel;
    }

    accumulatedDuration += inputFiles[i].duration;
    if (i > 0) accumulatedDuration -= transitionDuration;
  }

  const filterComplex = filterParts.join("");

  const inputArgs: string[] = [];
  for (const f of inputFiles) {
    inputArgs.push("-i", f.path);
  }

  await runFFmpeg(
    [
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", `[${lastLabel}]`,
      "-c:v", config.videoCodec,
      "-crf", String(config.crf),
      "-preset", "medium",
      "-r", String(fps),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ],
    onProgress
  );
}

// ─── Concatenate with per-segment transition sequence ───────

export async function concatWithTransitionSequence(
  inputFiles: { path: string; duration: number }[],
  outputPath: string,
  transitions: { type: TransitionType; duration: number }[],
  width: number,
  height: number,
  fps: number,
  onProgress?: (pct: number) => void
): Promise<void> {
  if (inputFiles.length === 0) throw new Error("No input files for concatenation");
  if (inputFiles.length === 1) {
    await fs.promises.copyFile(inputFiles[0].path, outputPath);
    return;
  }

  const filterParts: string[] = [];
  let lastLabel = "v0";
  let accumulatedDuration = 0; // Track running output duration for correct xfade offset

  for (let i = 0; i < inputFiles.length; i++) {
    // Normalize each segment: setpts + scale to target resolution
    filterParts.push(
      `[${i}:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`
    );

    let duration = 0;
    if (i > 0) {
      const outLabel = i === inputFiles.length - 1 ? "vout" : `vtemp${i}`;
      const transIdx = i - 1; // transition AFTER segment (i-1)
      const xfadeName = getXfadeTransition(transitions[transIdx]?.type || "fade");
      duration = transitions[transIdx]?.duration || 0.5;
      // offset = accumulated duration so far - transition duration
      const offset = accumulatedDuration - duration;
      filterParts.push(
        `[${lastLabel}][v${i}]xfade=transition=${xfadeName}:duration=${duration}:offset=${offset}[${outLabel}];`
      );
      lastLabel = outLabel;
    }

    accumulatedDuration += inputFiles[i].duration;
    if (i > 0) accumulatedDuration -= duration;
  }

  const filterComplex = filterParts.join("");

  const inputArgs: string[] = [];
  for (const f of inputFiles) {
    inputArgs.push("-i", f.path);
  }

  await runFFmpeg(
    [
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", `[${lastLabel}]`,
      "-c:v", config.videoCodec,
      "-crf", String(config.crf),
      "-preset", "medium",
      "-r", String(fps),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ],
    onProgress
  );
}

// ─── Add audio track (BGM) ──────────────────────────────────

export async function mixAudio(
  videoPath: string,
  bgmPath: string,
  outputPath: string,
  bgmVolume: number,
  videoDuration: number
): Promise<void> {
  // Loop BGM to match video duration, then mix
  await runFFmpeg([
    "-i", videoPath,
    "-stream_loop", "-1",
    "-i", bgmPath,
    "-c:v", "copy",
    "-filter_complex",
    `[1:a]volume=${bgmVolume},atrim=0:${videoDuration}[bgm];` +
    `[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    "-map", "0:v",
    "-map", "[aout]",
    "-shortest",
    "-c:a", "aac",
    "-b:a", "192k",
    outputPath,
  ]);
}

// ─── Add subtitles / text overlay ───────────────────────────

export async function addTextOverlay(
  videoPath: string,
  text: string,
  outputPath: string,
  fontPath?: string
): Promise<void> {
  const font = fontPath || "Sans";
  const escapedText = text.replace(/'/g, "\\'").replace(/:/g, "\\:");

  await runFFmpeg([
    "-i", videoPath,
    "-vf",
    `drawtext=fontfile='${font}':text='${escapedText}':` +
    `fontcolor=white:fontsize=36:box=1:boxcolor=black@0.5:boxborderw=8:` +
    `x=(w-text_w)/2:y=h-th-60`,
    "-c:v", config.videoCodec,
    "-crf", String(config.crf),
    "-preset", "medium",
    "-c:a", "copy",
    outputPath,
  ]);
}

// ─── Audio ducking ──────────────────────────────────────────

export async function applyBgmDucking(
  videoPath: string,
  outputPath: string,
  speechSegments: { start: number; end: number }[]
): Promise<void> {
  if (speechSegments.length === 0) {
    await fs.promises.copyFile(videoPath, outputPath);
    return;
  }

  // Build sidechain compression / volume envelope
  const envelopeParts = speechSegments.map((seg, i) => {
    return `volume='if(between(t,${seg.start},${seg.end}),0.3,1)':eval=frame`;
  });

  await runFFmpeg([
    "-i", videoPath,
    "-af", envelopeParts[0],
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    outputPath,
  ]);
}

// ─── Get video duration ─────────────────────────────────────

export async function getDuration(filePath: string): Promise<number> {
  const probe = await probeVideo(filePath);
  return probe.duration;
}

// ─── Time stretch (slow down) ────────────────────────────────

export async function timeStretchVideo(
  inputPath: string,
  outputPath: string,
  stretchFactor: number
): Promise<void> {
  // Build atempo audio filter chain (atempo takes speed factor, not duration factor)
  // stretchFactor=2 means we want 2x longer audio → atempo=0.5 (half speed)
  // stretchFactor=4 means we want 4x longer → atempo=0.25 (quarter speed)
  // Since atempo range is [0.5, 2.0], we chain multiple: atempo=0.5,atempo=0.5 = 0.25 effective
  let atempoChain = "";
  let remainingSpeed = 1 / stretchFactor; // Convert stretch factor to speed factor
  while (remainingSpeed < 0.5) {
    atempoChain += (atempoChain ? "," : "") + "atempo=0.5";
    remainingSpeed /= 0.5;
  }
  if (remainingSpeed <= 1.0) {
    atempoChain += (atempoChain ? "," : "") + `atempo=${remainingSpeed.toFixed(3)}`;
  }

  const vfFilter = `setpts=${stretchFactor.toFixed(3)}*PTS`;

  // Try with audio stretching first (some videos lack audio track)
  if (atempoChain) {
    try {
      await runFFmpeg([
        "-i", inputPath,
        "-filter_complex", `[0:v]${vfFilter}[vout];[0:a]${atempoChain}[aout]`,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", config.videoCodec,
        "-crf", String(config.crf),
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "192k",
        outputPath,
      ]);
      return;
    } catch {
      // Audio filter failed (likely no audio stream), fall back to video-only
    }
  }

  // Video-only stretch (no audio or audio stretch not needed)
  await runFFmpeg([
    "-i", inputPath,
    "-vf", vfFilter,
    "-c:v", config.videoCodec,
    "-crf", String(config.crf),
    "-preset", "medium",
    "-an",
    outputPath,
  ]);
}
