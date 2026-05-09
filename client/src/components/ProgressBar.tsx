import { clsx } from "clsx";

interface ProgressBarProps {
  value: number; // 0-100
  variant?: "default" | "success" | "danger";
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  variant = "default",
  showLabel = true,
  className,
}: ProgressBarProps) {
  const fillClass = {
    default: "progress-bar-fill",
    success: "progress-bar-fill-success",
    danger: "bg-red-500 h-full rounded-full transition-all duration-500 ease-out",
  }[variant];

  return (
    <div className={clsx("space-y-1", className)}>
      <div className="progress-bar">
        <div
          className={fillClass}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-2xs text-gray-400 text-right">
          {Math.round(value)}%
        </p>
      )}
    </div>
  );
}
