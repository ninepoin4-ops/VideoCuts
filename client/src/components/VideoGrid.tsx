import { clsx } from "clsx";
import { Play, Download, RefreshCw, AlertCircle } from "lucide-react";
import type { RenderResult } from "../types";

interface VideoGridProps {
  results: RenderResult[];
  taskId: string;
  onRetry?: (index: number) => void;
  onDownload?: (result: RenderResult) => void;
}

export function VideoGrid({
  results,
  taskId,
  onRetry,
  onDownload,
}: VideoGridProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Play className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">暂无渲染结果</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {results.map((result) => (
        <div
          key={result.index}
          className={clsx(
            "card overflow-hidden transition-all duration-200 hover:shadow-subtle",
            result.status === "failed" && "border-red-200"
          )}
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-gray-100">
            {result.thumbnailPath ? (
              <img
                src={result.thumbnailPath}
                alt={`Clip ${result.index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {result.status === "completed" ? (
                  <Play className="w-8 h-8 text-gray-300" />
                ) : result.status === "rendering" ? (
                  <div className="w-6 h-6 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
                ) : result.status === "failed" ? (
                  <div className="flex flex-col items-center gap-1 px-2">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    {result.error && (
                      <p className="text-2xs text-red-400 text-center leading-tight line-clamp-2" title={result.error}>
                        {result.error}
                      </p>
                    )}
                  </div>
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-300" />
                )}
              </div>
            )}

            {/* Overlay */}
            {result.status === "completed" && (
              <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                <a
                  href={result.outputPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                  title="再生"
                >
                  <Play className="w-4 h-4 text-charcoal" />
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload?.(result);
                  }}
                  className="p-2 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                  title="下载"
                >
                  <Download className="w-4 h-4 text-charcoal" />
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-charcoal">
                #{result.index + 1}
              </span>
              {result.duration && (
                <span className="text-2xs text-gray-400">
                  {Math.round(result.duration)}秒
                </span>
              )}
            </div>

            {result.status === "failed" && (
              <div className="space-y-1">
                <p className="text-2xs text-red-500 truncate">
                    {result.error || "渲染失败"}
                </p>
                {onRetry && (
                  <button
                    onClick={() => onRetry(result.index)}
                    className="flex items-center gap-1 text-2xs text-indigo hover:text-indigo-dark transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重试
                  </button>
                )}
              </div>
            )}

            {result.status === "rendering" && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
                <span className="text-2xs text-gray-500">渲染中...</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
