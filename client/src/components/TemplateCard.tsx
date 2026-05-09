import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Edit3, Play, Clock, Settings, FileText } from "lucide-react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { TRANSITION_LABELS } from "../types";
import type { Template } from "../types";

interface TemplateCardProps {
  template: Template;
  onGenerate: (template: Template) => void;
  onEdit: (template: Template) => void;
}

export function TemplateCard({ template, onGenerate, onEdit }: TemplateCardProps) {
  return (
    <Card className="p-5 flex flex-col gap-4 hover:shadow-subtle transition-shadow cursor-default">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-charcoal">{template.name}</h3>
          <p className="text-2xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {template.totalDuration}秒 · {template.segments.length}段
          </p>
        </div>
        <Badge variant="default">
          {template.segments.length}段
        </Badge>
      </div>

      {/* Segments preview */}
      <div className="flex items-center gap-1">
        {template.segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="h-8 rounded-md bg-indigo-light flex items-center justify-center text-2xs font-medium text-indigo-dark px-2"
              style={{ width: `${Math.max(seg.duration * 8, 32)}px` }}
              title={`${seg.duration}秒 - ${TRANSITION_LABELS[seg.transitionType]}`}
            >
              {seg.duration}s
            </div>
            {i < template.segments.length - 1 && (
              <span className="text-2xs text-gray-300 px-0.5">
                <Play className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Transitions */}
      <div className="flex flex-wrap gap-1">
        {template.segments.slice(0, -1).map((seg, i) => (
          <span key={i} className="text-2xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">
            {TRANSITION_LABELS[seg.transitionType]}
          </span>
        ))}
      </div>

      {/* Subtitle info */}
      {template.subtitleEnabled && (
        <div className="flex items-center gap-1 text-2xs text-sage-dark">
          <FileText className="w-3 h-3" />
          字幕已启用
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-50">
        <Button variant="primary" size="sm" className="flex-1" onClick={() => onGenerate(template)}>
          <Play className="w-3.5 h-3.5 mr-1" />
          替换生成
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(template)}>
          <Edit3 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}
