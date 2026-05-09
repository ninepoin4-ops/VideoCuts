import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LayoutTemplate, Settings, FolderOpen } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TemplateCard } from "../components/TemplateCard";
import { TemplateEditor } from "../components/TemplateEditor";
import { GenerateDialog } from "../components/GenerateDialog";
import { useTaskStore } from "../store/taskStore";
import { listTemplates, createTask, startTask } from "../api/client";
import type { Template, CreateTaskRequest } from "../types";

export function HomePage() {
  const navigate = useNavigate();
  const { addTask } = useTaskStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genTemplate, setGenTemplate] = useState<Template | null>(null);

  const fetchTemplates = async () => {
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleGenerate = (template: Template) => {
    setGenTemplate(template);
  };

  const handleCreateTask = async (req: CreateTaskRequest) => {
    setGenerating(true);
    try {
      const task = await createTask(req);
      addTask(task);
      await startTask(task.id);
      setGenTemplate(null);
      navigate("/tasks");
    } catch (err) {
      console.error("Task creation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal">模板库</h1>
          <p className="text-sm text-gray-500 mt-1">
            选择一个模板开始混剪
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate("/advanced")}>
            <Settings className="w-4 h-4 mr-1.5" />
            高级模式
          </Button>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            新建模板
          </Button>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 h-40 animate-pulse">
              <div className="h-4 w-2/3 bg-gray-100 rounded mb-3" />
              <div className="h-8 w-full bg-gray-50 rounded mb-3" />
              <div className="h-4 w-1/2 bg-gray-50 rounded" />
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <LayoutTemplate className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-4">还没有模板，创建一个开始吧</p>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            新建模板
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onGenerate={handleGenerate}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => { setEditorOpen(false); setEditingTemplate(null); }}
          onSaved={fetchTemplates}
        />
      )}

      {/* Generate Dialog */}
      {genTemplate && (
        <GenerateDialog
          template={genTemplate}
          onClose={() => setGenTemplate(null)}
          onCreate={handleCreateTask}
          creating={generating}
        />
      )}
    </div>
  );
}
