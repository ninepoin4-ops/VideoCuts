import { useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, Film } from "lucide-react";
import { TRANSITION_LABELS, type TransitionType } from "../types";

interface TransitionPickerProps {
  value: TransitionType;
  onChange: (type: TransitionType) => void;
  duration: number;
  onDurationChange: (d: number) => void;
}

const TRANSITIONS: TransitionType[] = [
  "fade", "dissolve", "flash-white", "flash-black",
  "wipe-left", "wipe-right", "wipe-up", "wipe-down",
  "diagonal-cut", "circle-open", "rect-mask",
  "zoom-punch", "blur", "pixelate", "glitch",
  "page-curl", "blinds", "spin-in", "spin-out",
  "shake-in", "soft-light", "jump-cut",
];

export function TransitionPicker({
  value,
  onChange,
  duration,
  onDurationChange,
}: TransitionPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-500">
        转场效果
      </label>

      <div className="flex gap-3">
        {/* Dropdown */}
        <div className="relative flex-1">
          <button
            type="button"
            className="input-field flex items-center justify-between text-left"
            onClick={() => setOpen(!open)}
          >
            <span className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo" />
              {TRANSITION_LABELS[value]}
            </span>
            <ChevronDown
              className={clsx(
                "w-4 h-4 text-gray-400 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-soft shadow-subtle max-h-48 overflow-y-auto animate-fade-in">
              {TRANSITIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={clsx(
                    "w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50",
                    t === value
                      ? "bg-indigo-light text-indigo-dark font-medium"
                      : "text-charcoal"
                  )}
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                >
                  {TRANSITION_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="w-32">
          <input
            type="number"
            min={0.1}
            max={3}
            step={0.1}
            value={duration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="input-field text-center"
          />
          <p className="text-2xs text-gray-400 text-center mt-0.5">秒</p>
        </div>
      </div>
    </div>
  );
}
