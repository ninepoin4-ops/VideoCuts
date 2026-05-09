import { clsx } from "clsx";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Badge } from "./ui/Badge";
import type { TaskItem } from "../types";

interface TaskCardProps {
  task: TaskItem;
  onClick?: () => void;
}

const STATUS_CONFIG = {
  pending: { label: "等待中", variant: "default" as const, icon: Clock },
  queued: { label: "排队中", variant: "info" as const, icon: Clock },
  processing: { label: "处理中", variant: "info" as const, icon: Loader2 },
  completed: { label: "已完成", variant: "success" as const, icon: CheckCircle2 },
  failed: { label: "失败", variant: "danger" as const, icon: XCircle },
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;
  const progress =
    task.totalCount > 0
      ? Math.round((task.completedCount / task.totalCount) * 100)
      : 0;

  return (
    <div
      className={clsx(
        "card-hover p-4 flex flex-col gap-3",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-charcoal truncate">
            {task.name}
          </h3>
          <p className="text-2xs text-gray-400 mt-0.5">
            {new Date(task.createdAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <Badge variant={config.variant}>
          <Icon
            className={clsx(
              "w-3 h-3 mr-1",
              task.status === "processing" && "animate-spin"
            )}
          />
          {config.label}
        </Badge>
      </div>

      {/* Progress bar */}
      {(task.status === "processing" || task.status === "completed") && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-2xs text-gray-400">
            <span>
              第 {task.completedCount} / {task.totalCount} 条
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className={
                task.status === "completed"
                  ? "progress-bar-fill-success"
                  : "progress-bar-fill"
              }
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Queue position */}
      {task.queuePosition > 0 && task.status === "queued" && (
        <p className="text-2xs text-gray-500">
          排队中，前方还有 {task.queuePosition} 个任务
        </p>
      )}

      {/* Failed count */}
      {task.failedCount > 0 && (
        <p className="text-2xs text-red-500">
          {task.failedCount}条渲染失败
        </p>
      )}

      {/* Error */}
      {task.error && (
        <p className="text-2xs text-red-500 truncate">{task.error}</p>
      )}
    </div>
  );
}
