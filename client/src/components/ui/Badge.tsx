import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variantClass = {
    default: "bg-gray-100 text-gray-600",
    success: "bg-sage-light text-sage-dark",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-600",
    info: "bg-indigo-light text-indigo-dark",
  }[variant];

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium",
        variantClass,
        className
      )}
    >
      {children}
    </span>
  );
}
