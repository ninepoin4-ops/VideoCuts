import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, Film, Play, Clock, FolderUp } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { listMaterials, uploadMaterial, deleteMaterial } from "../api/client";
import type { MaterialLibItem } from "../types";

export function MaterialLibraryPage() {
  const [materials, setMaterials] = useState<MaterialLibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMaterials = async () => {
    try {
      const data = await listMaterials();
      setMaterials(data);
    } catch (err) {
      console.error("Failed to fetch materials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) continue;
      try {
        // Use folder name from path if available (webkitRelativePath)
        const folderName = (file as any).webkitRelativePath
          ? (file as any).webkitRelativePath.split("/").slice(0, -1).join("/") || ""
          : "";
        await uploadMaterial(file, folderName);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    await fetchMaterials();
    setUploading(false);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal">素材管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            {materials.length}个视频素材
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="w-4 h-4 mr-1.5" />
          {uploading ? "上传中..." : "上传素材"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Drag zone */}
      <div
        className={`drop-zone min-h-[120px] flex flex-col items-center justify-center gap-2 ${
          dragOver ? "drop-zone-active" : ""
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <FolderUp className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-400">拖拽视频文件或文件夹到此处上传</p>
        <p className="text-2xs text-gray-300">支持 MP4, MOV, AVI 等格式</p>
      </div>

      {/* Material grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-0 h-32 animate-pulse">
              <div className="bg-gray-100 h-20 rounded-t-lg" />
              <div className="p-2">
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <Card className="p-12 text-center">
          <Film className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">还没有素材，上传视频文件开始</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {materials.map((mat) => (
            <Card key={mat.id} className="p-0 overflow-hidden group">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-100">
                {mat.thumbnailPath ? (
                  <img
                    src={mat.thumbnailPath}
                    alt={mat.originalName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleDelete(mat.id)}
                    className="p-2 bg-white/90 rounded-full shadow hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-2 space-y-1">
                <p className="text-2xs text-charcoal truncate" title={mat.originalName}>
                  {mat.originalName}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-2xs text-gray-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {mat.duration.toFixed(1)}s
                  </span>
                  <span className="text-2xs text-gray-400">
                    {mat.width}x{mat.height}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
