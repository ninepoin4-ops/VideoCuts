import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Wand2, Package, Clock, Play, Settings } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import type { Template, CreateTaskRequest } from "../types";

interface GenerateDialogProps {
  template: Template;
  onClose: () => void;
  onCreate: (req: CreateTaskRequest) => void;
  creating: boolean;
}

export function GenerateDialog({ template, onClose, onCreate, creating }: GenerateDialogProps) {
  const [name, setName] = useState(`${template.name}_生成`);
  const [count, setCount] = useState(10);
  const [addSubtitles, setAddSubtitles] = useState(template.subtitleEnabled);

  const handleSubmit = () => {
    onCreate({
      name,
      mode: "template",
      templateId: template.id,
      count,
      addSubtitles,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => onClose()}>
      <Card
        className="w-full max-w-md p-6 space-y-5 animate-fade-in"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-charcoal">替换生成</h2>
          <Badge variant="default">{template.totalDuration}秒</Badge>
        </div>

        <div className="text-sm text-gray-500">
          使用模板 <b className="text-charcoal">「{template.name}」</b> 从素材库中随机选取视频填入各段，生成多条成片。
        </div>

        {/* Template info */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-soft">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-charcoal">{template.segments.length}段 · {template.totalDuration}秒</span>
          </div>
          <div className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">素材库随机抽取</span>
          </div>
        </div>

        {/* Config */}
        <Input label="任务名称" value={name} onChange={(e) => setName(e.target.value)} />

        <Input
          label="生成条数"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value))))}
          hint="1~100条"
        />

        {template.subtitleEnabled && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={addSubtitles}
              onChange={(e) => setAddSubtitles(e.target.checked)}
              className="rounded"
            />
            添加字幕（覆盖模板默认）
          </label>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">取消</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={creating} className="flex-1">
            <Wand2 className="w-4 h-4 mr-1" />
            {creating ? "创建中..." : `生成 ${count} 条`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
