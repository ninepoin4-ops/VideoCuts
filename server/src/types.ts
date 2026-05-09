// ─── Task & Queue ────────────────────────────────────────────

export type TaskStatus = "pending" | "queued" | "processing" | "completed" | "failed";
export type TaskMode = "template" | "free";

export interface TaskItem {
  id: string;
  name: string;
  status: TaskStatus;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  queuePosition: number;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  config: TaskConfig;
  results: RenderResult[];
  error: string | null;
}

export interface TaskConfig {
  // Mode: "template" uses templateId, "free" uses groups
  mode: TaskMode;
  templateId?: string;

  // Free mode: slot groups
  groups: SlotGroup[];

  // Transitions (free mode uses single global, template mode uses per-segment)
  transitionType: TransitionType;
  transitionDuration: number;

  // Text
  texts: CaptionText[];
  addSubtitles: boolean;

  // Audio
  bgmPath: string | null;
  bgmVolume: number;
  ttsEnabled: boolean;
  ttsVolume: number;
  bgmDuckOnSpeech: boolean;
  speechGap: number;

  // Count
  count: number;

  // Output
  outputFormat: "mp4";
  minSegmentDuration: number;
  maxSegmentDuration: number;
}

// ─── Template ────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  totalDuration: number;
  segments: TemplateSegment[];
  subtitleEnabled: boolean;
  subtitleStyle: SubtitleStyle;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSegment {
  index: number;           // 0-based segment position
  duration: number;        // seconds
  transitionType: TransitionType;  // transition AFTER this segment (null for last)
}

export interface SubtitleStyle {
  position: "top" | "center" | "bottom";
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  strokeColor: string;
  strokeWidth: number;
  animation: "none" | "fade-in" | "slide-up" | "typewriter";
}

// ─── Material Library ────────────────────────────────────────

export interface MaterialLibItem {
  id: string;
  originalName: string;
  storedPath: string;
  thumbnailPath: string | null;
  folderName: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  size: number;
  createdAt: string;
}

// ─── Slots & Groups (free mode) ─────────────────────────────

export type SlotType = "opening" | "middle" | "ending";

export interface SlotGroup {
  id: string;
  name: string;
  slotType: SlotType;
  files: MediaFile[];
}

export interface MediaFile {
  id: string;
  originalName: string;
  storedPath: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  size: number;
}

// ─── Render Results ─────────────────────────────────────────

export interface RenderResult {
  index: number;
  outputPath: string;
  thumbnailPath: string | null;
  status: "pending" | "rendering" | "completed" | "failed";
  error: string | null;
  duration: number | null;
  config: RenderConfig;
}

export interface RenderConfig {
  segments: VideoSegment[];
  transition: TransitionType;
  transitionDuration: number;
  text: string | null;
}

export interface VideoSegment {
  fileId: string;
  sourcePath: string;
  startTime: number;
  duration: number;
  slotType: SlotType;
  needsStretch?: boolean;
  stretchFactor?: number;
}

// ─── Transitions ────────────────────────────────────────────

export type TransitionType =
  | "fade"
  | "dissolve"
  | "flash-white"
  | "flash-black"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "diagonal-cut"
  | "circle-open"
  | "rect-mask"
  | "zoom-punch"
  | "blur"
  | "pixelate"
  | "glitch"
  | "page-curl"
  | "blinds"
  | "spin-in"
  | "spin-out"
  | "shake-in"
  | "soft-light"
  | "jump-cut";

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  fade: "淡入淡出",
  dissolve: "交叉溶解",
  "flash-white": "闪白",
  "flash-black": "闪黑",
  "wipe-left": "左划像",
  "wipe-right": "右划像",
  "wipe-up": "上划像",
  "wipe-down": "下划像",
  "diagonal-cut": "对角线切割",
  "circle-open": "圆形展开",
  "rect-mask": "矩形遮罩",
  "zoom-punch": "缩放冲击",
  blur: "模糊过渡",
  pixelate: "像素化",
  glitch: "故障风",
  "page-curl": "翻页",
  blinds: "百叶窗",
  "spin-in": "旋入",
  "spin-out": "旋出",
  "shake-in": "震动切入",
  "soft-light": "柔光溢出",
  "jump-cut": "抽帧跳切",
};

// ─── Captions & Text ────────────────────────────────────────

export interface CaptionText {
  id: string;
  template: string;
  variables: Record<string, string>;
}

// ─── API Types ──────────────────────────────────────────────

export interface CreateTaskRequest {
  name: string;
  mode: TaskMode;
  templateId?: string;
  count: number;
  addSubtitles?: boolean;
  transitionType?: TransitionType;
  transitionDuration?: number;
  texts?: CaptionText[];
  bgmPath?: string | null;
  bgmVolume?: number;
  ttsEnabled?: boolean;
  ttsVolume?: number;
  bgmDuckOnSpeech?: boolean;
  speechGap?: number;
  minSegmentDuration?: number;
  maxSegmentDuration?: number;
}

export interface CreateTemplateRequest {
  name: string;
  segments: { duration: number; transitionType: TransitionType }[];
  subtitleEnabled?: boolean;
  subtitleStyle?: SubtitleStyle;
}

export interface UpdateTemplateRequest {
  name?: string;
  segments?: { duration: number; transitionType: TransitionType }[];
  subtitleEnabled?: boolean;
  subtitleStyle?: SubtitleStyle;
}

export interface TaskProgressPayload {
  taskId: string;
  status: TaskStatus;
  completedCount: number;
  totalCount: number;
  failedCount: number;
  queuePosition: number;
  currentRender?: RenderResult;
  results?: RenderResult[];
}

export interface UploadResponse {
  groupId: string;
  files: MediaFile[];
  errors: string[];
}
