import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { TransitionPicker } from "./TransitionPicker";
import { uploadBgm } from "../api/client";
import type { CreateTaskRequest, CaptionText, TransitionType } from "../types";

interface TaskFormProps {
  onSubmit: (data: CreateTaskRequest) => void;
  loading?: boolean;
}

export function TaskForm({ onSubmit, loading }: TaskFormProps) {
  const [name, setName] = useState("新建混剪");
  const [count, setCount] = useState(10);
  const [transitionType, setTransitionType] = useState<TransitionType>("fade");
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [minSeg, setMinSeg] = useState(2);
  const [maxSeg, setMaxSeg] = useState(6);
  const [bgmVolume, setBgmVolume] = useState(0.3);
  const [textInput, setTextInput] = useState("");
  const [bgmPath, setBgmPath] = useState<string | null>(null);

  const handleSubmit = () => {
    const texts: CaptionText[] = textInput
      .split("\n")
      .filter((line) => line.trim())
      .map((template, i) => ({
        id: `text_${i}`,
        template: template.trim(),
        variables: {},
      }));

    onSubmit({
      name,
      mode: "free",
      count,
      transitionType,
      transitionDuration,
      texts,
      bgmPath,
      bgmVolume,
      ttsEnabled: false,
      ttsVolume: 0.7,
      bgmDuckOnSpeech: true,
      speechGap: 0.5,
      minSegmentDuration: minSeg,
      maxSegmentDuration: maxSeg,
    });
  };

  return (
    <div className="space-y-6">
      {/* Task name + count */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="任务名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="生成数"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          hint="1~100条"
        />
      </div>

      {/* Transition picker */}
      <TransitionPicker
        value={transitionType}
        onChange={setTransitionType}
        duration={transitionDuration}
        onDurationChange={setTransitionDuration}
      />

      {/* Segment duration */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="最小片段长度 (秒)"
          type="number"
          min={1}
          max={30}
          step={0.5}
          value={minSeg}
          onChange={(e) => setMinSeg(Number(e.target.value))}
        />
        <Input
          label="最大片段长度 (秒)"
          type="number"
          min={1}
          max={60}
          step={0.5}
          value={maxSeg}
          onChange={(e) => setMaxSeg(Number(e.target.value))}
        />
      </div>

      {/* Text input */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">
          文本 (每行一条, 支持Excel/CSV上传)
        </label>
        <textarea
          className="input-field min-h-[100px] resize-y"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={"产品介绍 {商品名}\n使用指南 {商品名}\n评测视频 {商品名}"}
        />
      </div>

      {/* BGM */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">BGM</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="audio/*"
            className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-soft file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-charcoal hover:file:bg-gray-200"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const result = await uploadBgm(file);
                setBgmPath(result.path);
              } catch (err) {
                console.error("BGM upload failed:", err);
              }
            }}
          />
          {bgmPath && (
            <span className="text-xs text-sage-dark">BGM已设置</span>
          )}
        </div>
      </div>

      {/* BGM volume */}
      <Input
        label="BGM音量"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={bgmVolume}
        onChange={(e) => setBgmVolume(Number(e.target.value))}
      />

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? "创建中..." : "创建任务并执行"}
      </Button>
    </div>
  );
}
