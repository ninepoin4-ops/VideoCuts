import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { TaskCard } from "../components/TaskCard";
import { TaskQueue } from "../components/TaskQueue";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useTaskStore } from "../store/taskStore";
import { useSocket } from "../api/useSocket";
import { listTasks } from "../api/client";
import type { TaskItem } from "../types";

export function TasksPage() {
  const navigate = useNavigate();
  const { tasks, setTasks, updateTaskFromProgress } = useTaskStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  // WebSocket connection for real-time updates
  useSocket(updateTaskFromProgress);

  // Fetch tasks on mount
  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await listTasks();
        setTasks(data);
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      }
    };
    fetch();
  }, [setTasks]);

  const taskList = Array.isArray(tasks) ? tasks : [];
  const filtered = taskList.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filter !== "all" && t.status !== filter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal">任务列表</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length}个任务
          </p>
        </div>
        <Button onClick={() => navigate("/")}>
          新建任务
        </Button>
      </div>

      {/* Queue status */}
      <TaskQueue />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-9"
              placeholder="搜索任务名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-soft">
          {[
          { key: "all", label: "全部" },
          { key: "processing", label: "处理中" },
          { key: "queued", label: "排队中" },
          { key: "completed", label: "已完成" },
          { key: "failed", label: "失败" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-white text-charcoal shadow-subtle"
                  : "text-gray-500 hover:text-charcoal"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <SlidersHorizontal className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无匹配任务</p>
          </div>
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => navigate(`/tasks/${task.id}/results`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
