import { useState, useEffect } from "react";
import { X, Plus, Trash2, Clock } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";
import { TransitionPicker } from "./TransitionPicker";
import { createTemplate, updateTemplate } from "../api/client";
import { TRANSITION_LABELS } from "../types";
import type { Template, TemplateSegment, TransitionType, SubtitleStyle } from "../types";

interface TemplateEditorProps {
  template?: Template | null;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_SEGMENTS: { duration: number; transitionType: TransitionType }[] = [
  { duration: 4, transitionType: "dissolve" },
  { duration: 4, transitionType: "fade" },
  { duration: 4, transitionType: "dissolve" },
  { duration: 4, transitionType: "fade" },
];

const DEFAULT_STYLE: SubtitleStyle = {
  position: "bottom",
  fontFamily: "Arial",
  fontSize: 24,
  fontColor: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 1,
  animation: "fade-in",
};

export function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || "新模板");
  const [segments, setSegments] = useState<{ duration: number; transitionType: TransitionType }[]>(
    template?.segments.map((s) => ({ duration: s.duration, transitionType: s.transitionType })) || DEFAULT_SEGMENTS
  );
  const [subtitleEnabled, setSubtitleEnabled] = useState(template?.subtitleEnabled || false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    template?.subtitleStyle || DEFAULT_STYLE
  );
  const [saving, setSaving] = useState(false);

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  const updateSegment = (index: number, field: string, value: number | TransitionType) => {
    setSegments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const addSegment = () => {
    setSegments((prev) => [...prev, { duration: 4, transitionType: "fade" }]);
  };

  const removeSegment = (index: number) => {
    if (segments.length <= 1) return;
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (template?.id) {
        await updateTemplate(template.id, { name, segments });
      } else {
        await createTemplate({ name, segments, subtitleEnabled, subtitleStyle });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save template failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => onClose()}>
      <Card
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-5 animate-fade-in"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-charcoal">
            {template ? "编辑模板" : "新建模板"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Name */}
        <Input label="模板名称" value={name} onChange={(e) => setName(e.target.value)} />

        {/* Duration summary */}
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-soft px-3 py-2">
          <Clock className="w-4 h-4" />
          <span>总时长: {totalDuration}秒 · {segments.length}段</span>
        </div>

        {/* Segments */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">视频分段</label>
          <div className="space-y-2">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-soft">
                <span className="text-2xs text-gray-400 w-5">#{i + 1}</span>
                <input
                  type="number"
                  className="w-16 px-2 py-1 text-sm border border-gray-200 rounded"
                  value={seg.duration}
                  min={0.5}
                  max={60}
                  step={0.5}
                  onChange={(e) => updateSegment(i, "duration", Number(e.target.value))}
                />
                <span className="text-2xs text-gray-400">秒</span>
                <div className="flex-1">
                  <TransitionPickerMini
                    value={seg.transitionType}
                    onChange={(t) => updateSegment(i, "transitionType", t)}
                    hideLabel={i === segments.length - 1}
                  />
                </div>
                {segments.length > 1 && (
                  <button
                    onClick={() => removeSegment(i)}
                    className="text-gray-300 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addSegment}
            className="mt-2 flex items-center gap-1 text-xs text-indigo hover:text-indigo-dark"
          >
            <Plus className="w-3 h-3" />
            添加分段
          </button>
        </div>

        {/* Subtitle */}
        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <input
              type="checkbox"
              checked={subtitleEnabled}
              onChange={(e) => setSubtitleEnabled(e.target.checked)}
              className="rounded"
            />
            添加字幕
          </label>
          {subtitleEnabled && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                className="input-field text-xs"
                value={subtitleStyle.position}
                onChange={(e) => setSubtitleStyle({ ...subtitleStyle, position: e.target.value as SubtitleStyle["position"] })}
              >
                <option value="bottom">底部</option>
                <option value="center">中间</option>
                <option value="top">顶部</option>
              </select>
              <select
                className="input-field text-xs"
                value={subtitleStyle.animation}
                onChange={(e) => setSubtitleStyle({ ...subtitleStyle, animation: e.target.value as SubtitleStyle["animation"] })}
              >
                <option value="fade-in">淡入</option>
                <option value="slide-up">上滑</option>
                <option value="typewriter">打字机</option>
                <option value="none">无动画</option>
              </select>
              <input
                type="number"
                className="input-field text-xs"
                value={subtitleStyle.fontSize}
                min={12}
                max={48}
                onChange={(e) => setSubtitleStyle({ ...subtitleStyle, fontSize: Number(e.target.value) })}
                placeholder="字号"
              />
              <input
                type="color"
                className="w-full h-8 rounded border border-gray-200"
                value={subtitleStyle.fontColor}
                onChange={(e) => setSubtitleStyle({ ...subtitleStyle, fontColor: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">取消</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "保存中..." : "保存模板"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TransitionPickerMini({ value, onChange, hideLabel }: {
  value: TransitionType; onChange: (t: TransitionType) => void; hideLabel: boolean;
}) {
  return (
    <select
      className="w-full px-2 py-1 text-2xs border border-gray-200 rounded bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value as TransitionType)}
    >
      {Object.entries(TRANSITION_LABELS).map(([k, v]) => (
        <option key={k} value={k}>{v + (hideLabel ? " (末段)" : "")}</option>
      ))}
    </select>
  );
}
