import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useTaskStore } from "../store/taskStore";
import { getQueue } from "../api/client";
import { Badge } from "./ui/Badge";

export function TaskQueue() {
  const { tasks, queueLength, setQueueLength } = useTaskStore();
  const [queuePositions, setQueuePositions] = useState<
    { taskId: string; queuePosition: number }[]
  >([]);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const data = await getQueue();
        setQueueLength(data.queueLength);
        setQueuePositions(data.positions);
      } catch {
        // ignore
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [setQueueLength]);

  const queuedTasks = tasks.filter((t) => t.status === "queued");

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-charcoal flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          渲染队列
        </h3>
        <Badge variant="info">{queuedTasks.length} 等待中</Badge>
      </div>

      {queuedTasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">暂无排队任务</p>
      ) : (
        <div className="space-y-2">
          {queuedTasks.map((task, idx) => (
            <div
              key={task.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-soft"
            >
              <span className="text-sm text-charcoal truncate">
                {task.name}
              </span>
              <span className="text-2xs text-gray-500 ml-2 shrink-0">
                排队中，前方还有 {idx} 个任务
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
