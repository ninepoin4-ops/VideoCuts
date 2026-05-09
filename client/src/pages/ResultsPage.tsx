import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { VideoGrid } from "../components/VideoGrid";
import { useTaskStore } from "../store/taskStore";
import { useSocket } from "../api/useSocket";
import { getTask, retryRender, deleteTask } from "../api/client";
import type { TaskItem, RenderResult } from "../types";

export function ResultsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { updateTaskFromProgress, removeTask, updateTask } = useTaskStore();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(true);

  // WebSocket for real-time updates
  useSocket(updateTaskFromProgress);

  // Fetch task details
  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getTask(taskId);
      setTask(data);
      updateTask(data);
    } catch (err) {
      console.error("Failed to fetch task:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId, updateTask]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Poll while processing
  useEffect(() => {
    if (!task || (task.status !== "processing" && task.status !== "queued"))
      return;
    const interval = setInterval(fetchTask, 3000);
    return () => clearInterval(interval);
  }, [task?.status, fetchTask, task]);

  const handleRetry = async (index: number) => {
    if (!taskId) return;
    try {
      await retryRender(taskId, index);
      fetchTask();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    if (!window.confirm("确认删除此任务？")) return;
    try {
      await deleteTask(taskId);
      removeTask(taskId);
      navigate("/tasks");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDownloadAll = () => {
    if (!taskId) return;
    window.open(`/api/export/${taskId}/zip`, "_blank");
  };

  const handleDownloadSingle = (result: RenderResult) => {
    const filename = result.outputPath.split("/").pop() || "video.mp4";
    window.open(`/api/export/${taskId}/${filename}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-indigo animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500">任务未找到</p>
        <Button onClick={() => navigate("/tasks")} className="mt-4">
          返回任务列表
        </Button>
      </div>
    );
  }

  const results: RenderResult[] = task.results || [];
  const completedCount = results.filter((r) => r.status === "completed").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const totalCount = task.totalCount;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const statusIcon = {
    pending: <Clock className="w-4 h-4" />,
    queued: <Clock className="w-4 h-4" />,
    processing: <Loader2 className="w-4 h-4 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4" />,
    failed: <XCircle className="w-4 h-4" />,
  }[task.status];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/tasks")}
            className="p-1.5 hover:bg-gray-100 rounded-soft transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-charcoal">{task.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant={
                  task.status === "completed"
                    ? "success"
                    : task.status === "failed"
                    ? "danger"
                    : "info"
                }
              >
                <span className="flex items-center gap-1">
                  {statusIcon}
              { task.status === "processing" ? "处理中" : task.status === "failed" ? "失败" : task.status === "completed" ? "已完成" : "等待中" }
                </span>
              </Badge>
              {task.queuePosition > 0 && (
                <span className="text-2xs text-gray-500">
                  前方还有 {task.queuePosition} 个
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleDownloadAll}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              批量下载
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
             删除
          </Button>
        </div>
      </div>

      {/* Task-level error */}
      {task.error && (
        <div className="card border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">任务执行失败</p>
              <p className="text-xs text-red-600 mt-1 leading-relaxed break-all">{task.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress overview */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-charcoal">进度情况</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-sage-dark">
              <CheckCircle2 className="w-4 h-4" />
              {completedCount} 成功
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="w-4 h-4" />
                {failedCount} 失败
              </span>
            )}
          </div>
        </div>
        <ProgressBar
          value={progress}
          variant={
            task.status === "completed" && failedCount === 0
              ? "success"
              : failedCount > 0
              ? "danger"
              : "default"
          }
        />
      </div>

      {/* Results grid */}
      <section>
        <h2 className="text-sm font-semibold text-charcoal mb-3">
          生成结果 ({completedCount}/{totalCount})
        </h2>
        <VideoGrid
          results={results}
          taskId={task.id}
          onRetry={handleRetry}
          onDownload={handleDownloadSingle}
        />
      </section>
    </div>
  );
}
