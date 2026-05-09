import { type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import {
  Film,
  ListTodo,
  FolderOpen,
  Wand2,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: Film, label: "模板库", path: "/" },
  { icon: FolderOpen, label: "素材管理", path: "/files" },
  { icon: ListTodo, label: "任务列表", path: "/tasks" },
  { icon: Wand2, label: "高级模式", path: "/advanced" },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-cream">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-50">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
          >
            <div className="w-8 h-8 bg-indigo rounded-lg flex items-center justify-center">
              <Film className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-charcoal tracking-tight">
              VideoCuts
            </span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-soft text-sm transition-all duration-150",
                  isActive
                    ? "bg-indigo-light text-indigo-dark font-medium"
                    : "text-gray-500 hover:bg-gray-50 hover:text-charcoal"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-sage-light flex items-center justify-center">
              <span className="text-2xs font-semibold text-sage-dark">V</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-charcoal truncate">
                VideoCuts
              </p>
              <p className="text-2xs text-gray-400">批量混剪工具</p>
              </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
