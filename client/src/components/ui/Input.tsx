import { type InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs font-medium text-gray-500">{label}</label>
        )}
        <input
          ref={ref}
          className={clsx(
            "input-field",
            error && "border-red-300 focus:border-red-400 focus:ring-red-100",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <span className="text-2xs text-gray-400">{hint}</span>
        )}
        {error && (
          <span className="text-2xs text-red-500">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
