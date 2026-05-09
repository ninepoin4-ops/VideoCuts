import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FolderOpen } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { UploadZone } from "../components/UploadZone";
import { TaskForm } from "../components/TaskForm";
import { TaskQueue } from "../components/TaskQueue";
import { useTaskStore } from "../store/taskStore";
import { createTask, startTask, uploadTexts } from "../api/client";
import type { CreateTaskRequest, SlotType, CaptionText } from "../types";

const SLOT_CONFIGS: { type: SlotType; label: string; description: string }[] = [
  { type: "opening", label: "开头", description: "用于视频开头的素材" },
  { type: "middle", label: "主体", description: "用于视频中间的素材" },
  { type: "ending", label: "结尾", description: "用于视频最后的素材" },
];

export function AdvancedPage() {
  const navigate = useNavigate();
  const { addTask } = useTaskStore();
  const [uploadedGroups, setUploadedGroups] = useState<
    Record<string, { id: string; files: { id: string; originalName: string }[] }>
  >({});
  const [loading, setLoading] = useState(false);
  const [texts, setTexts] = useState<CaptionText[]>([]);

  const handleFileUploaded = useCallback(
    (slotType: string, groupName: string) =>
      (file: { id: string; originalName: string }) => {
        const key = `${slotType}:${groupName}`;
        setUploadedGroups((prev) => {
          const existing = prev[key];
          if (existing) {
            return {
              ...prev,
              [key]: { ...existing, files: [...existing.files, file] },
            };
          }
          return { ...prev, [key]: { id: `group_${Date.now()}`, files: [file] } };
        });
      },
    []
  );

  const handleTextUpload = async (file: File) => {
    try {
      const result = await uploadTexts(file);
      setTexts(result.texts);
    } catch (err) {
      console.error("Text upload failed:", err);
    }
  };

  const handleSubmit = async (data: CreateTaskRequest) => {
    setLoading(true);
    try {
      if (texts.length > 0) data.texts = texts;
      data.mode = "free";
      const task = await createTask(data);
      addTask(task);
      await startTask(task.id);
      navigate("/tasks");
    } catch (err) {
      console.error("Task creation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-charcoal">高级模式</h1>
          </div>
          <p className="text-sm text-gray-500">自由混剪 — 手动选择素材分组和配置</p>
        </div>
      </div>

      {/* Upload zones */}
      <div>
        <h2 className="text-sm font-semibold text-charcoal mb-3">上传素材</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SLOT_CONFIGS.map((config) => (
            <div key={config.type} className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500">
                {config.label} <span className="text-gray-300">— {config.description}</span>
              </h3>
              <UploadZone
                slotType={config.type}
                groupName={`${config.type}_group`}
                onFileUploaded={handleFileUploaded(config.type, `${config.type}_group`)}
              />
              {/* Show uploaded files */}
              {uploadedGroups[`${config.type}:${config.type}_group`] && (
                <div className="text-2xs text-gray-400">
                  已上传 {uploadedGroups[`${config.type}:${config.type}_group`].files.length} 个文件
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Text upload */}
      <div>
        <h2 className="text-sm font-semibold text-charcoal mb-2">文案注入（可选）</h2>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleTextUpload(e.target.files[0])}
              className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:text-xs file:rounded file:border-0 file:bg-indigo-light file:text-indigo-dark file:font-medium"
            />
            {texts.length > 0 && (
              <span className="text-xs text-sage-dark">{texts.length} 行文案</span>
            )}
          </div>
        </Card>
      </div>

      {/* Task form */}
      <div>
        <h2 className="text-sm font-semibold text-charcoal mb-3">混剪配置</h2>
        <Card className="p-6">
          <TaskForm onSubmit={handleSubmit} loading={loading} />
        </Card>
      </div>

      {/* Queue */}
      <TaskQueue />
    </div>
  );
}
