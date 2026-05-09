import { create } from "zustand";
import type { TaskItem, TaskProgressPayload } from "../types";

interface TaskStore {
  tasks: TaskItem[];
  activeTaskId: string | null;
  queueLength: number;

  setTasks: (tasks: TaskItem[]) => void;
  addTask: (task: TaskItem) => void;
  updateTaskFromProgress: (payload: TaskProgressPayload) => void;
  updateTask: (task: TaskItem) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  setQueueLength: (length: number) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  activeTaskId: null,
  queueLength: 0,

  setTasks: (tasks) => set({ tasks: Array.isArray(tasks) ? tasks : [] }),

  addTask: (task) =>
    set((state) => ({
      tasks: state.tasks ? [task, ...state.tasks] : [task],
    })),

  updateTaskFromProgress: (payload) =>
    set((state) => ({
      tasks: Array.isArray(state.tasks)
        ? state.tasks.map((t) =>
            t.id === payload.taskId
              ? {
                  ...t,
                  status: payload.status,
                  completedCount: payload.completedCount,
                  totalCount: payload.totalCount,
                  failedCount: payload.failedCount,
                  queuePosition: payload.queuePosition,
                }
              : t
          )
        : [],
    })),

  updateTask: (task) =>
    set((state) => ({
      tasks: Array.isArray(state.tasks)
        ? state.tasks.map((t) => (t.id === task.id ? task : t))
        : [task],
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: Array.isArray(state.tasks)
        ? state.tasks.filter((t) => t.id !== id)
        : [],
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    })),

  setActiveTask: (id) => set({ activeTaskId: id }),

  setQueueLength: (length) => set({ queueLength: length }),
}));
