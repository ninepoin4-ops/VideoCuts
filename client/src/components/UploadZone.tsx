import { useState, useRef, useCallback, type DragEvent } from "react";
import { clsx } from "clsx";
import { Upload, Video, FolderOpen } from "lucide-react";
import { uploadVideo } from "../api/client";
import type { SlotType } from "../types";

interface UploadZoneProps {
  slotType: SlotType;
  groupName: string;
  onFileUploaded: (file: { id: string; originalName: string }) => void;
}

const SLOT_LABELS: Record<SlotType, string> = {
  opening: "开头",
  middle: "中间",
  ending: "结尾",
};

export function UploadZone({
  slotType,
  groupName,
  onFileUploaded,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("video/")
      );

      if (files.length === 0) return;

      setUploading(true);
      for (const file of files) {
        try {
          const result = await uploadVideo(file, slotType, groupName);
          onFileUploaded(result.file);
        } catch (err) {
          console.error("Upload failed:", err);
        }
      }
      setUploading(false);
    },
    [slotType, groupName, onFileUploaded]
  );

  const handleFileSelect = async () => {
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      try {
        const result = await uploadVideo(file, slotType, groupName);
        onFileUploaded(result.file);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    setUploading(false);
    // Reset input so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={clsx(
        "drop-zone flex flex-col items-center justify-center gap-3 min-h-[160px]",
        isDragging && "drop-zone-active",
        uploading && "opacity-60 pointer-events-none"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={handleFileSelect}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />

      {uploading ? (
        <>
          <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">上传中...</p>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full bg-indigo-light flex items-center justify-center">
            {isDragging ? (
              <FolderOpen className="w-5 h-5 text-indigo" />
            ) : (
              <Upload className="w-5 h-5 text-indigo" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-charcoal">
              {isDragging ? "松开以上传" : "拖拽视频到此处"}
            </p>
            <p className="text-2xs text-gray-400 mt-0.5">
              或点击选择文件 · {SLOT_LABELS[slotType]}槽位
            </p>
          </div>
        </>
      )}
    </div>
  );
}
