import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

export const config = {
  // Paths
  rootDir: ROOT,
  dataDir: path.join(ROOT, "data"),
  uploadsDir: path.join(ROOT, "data", "uploads"),
  outputsDir: path.join(ROOT, "data", "outputs"),
  cacheDir: path.join(ROOT, "data", "cache"),
  dbPath: path.join(ROOT, "data", "db", "videocuts.db"),

  // Server
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || "0.0.0.0",

  // FFmpeg
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",

  // Video encoding
  videoCodec: process.env.VIDEO_CODEC || "libx264", // libx264 or libx265
  crf: Number(process.env.CRF) || 18,
  maxConcurrentJobs: 1, // Single-threaded render

  // Upload
  maxUploadSize: 1024 * 1024 * 1024 * 5, // 5GB

  // Transition defaults
  defaultTransitionDuration: 0.5, // seconds
  defaultTransitionType: "fade",

  // TTS
  ttsEnabled: false,
  ttsVoice: process.env.TTS_VOICE || "default",
} as const;

export type Config = typeof config;
