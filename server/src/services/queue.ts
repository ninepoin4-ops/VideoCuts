import type { TaskItem, TaskProgressPayload } from "../types.js";
import { db } from "../db.js";
import { processTask } from "./mixer.js";

type ProgressCallback = (payload: TaskProgressPayload) => void;

class TaskQueue {
  private queue: string[] = [];
  private processing = false;
  private listeners: Set<ProgressCallback> = new Set();

  onProgress(cb: ProgressCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(payload: TaskProgressPayload): void {
    for (const cb of this.listeners) {
      try { cb(payload); } catch { /* noop */ }
    }
  }

  async enqueue(taskId: string): Promise<void> {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as TaskItem | undefined;
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Set queued status
    const position = this.queue.length;
    db.prepare("UPDATE tasks SET status = 'queued', queue_position = ? WHERE id = ?")
      .run(position, taskId);
    this.queue.push(taskId);

    this.notify({
      taskId,
      status: "queued",
      completedCount: task.completedCount,
      totalCount: task.totalCount,
      failedCount: task.failedCount,
      queuePosition: position,
    });

    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const taskId = this.queue.shift()!;

    db.prepare("UPDATE tasks SET status = 'processing', started_at = datetime('now') WHERE id = ?")
      .run(taskId);

    // Update queue positions for remaining tasks
    this.updateQueuePositions();

    this.notify({
      taskId,
      status: "processing",
      completedCount: 0,
      totalCount: 0,
      failedCount: 0,
      queuePosition: 0,
    });

    try {
      await processTask(taskId, (progress) => {
        db.prepare(
          "UPDATE tasks SET completed_count = ?, failed_count = ?, results_json = ? WHERE id = ?"
        ).run(progress.completedCount, progress.failedCount, JSON.stringify(progress.results || []), taskId);

        this.notify({ ...progress, queuePosition: 0 });
      });

      db.prepare(
        "UPDATE tasks SET status = 'completed', completed_at = datetime('now'), queue_position = -1 WHERE id = ?"
      ).run(taskId);

      this.notify({
        taskId,
        status: "completed",
        completedCount: (db.prepare("SELECT completed_count FROM tasks WHERE id = ?").get(taskId) as { completed_count: number })?.completed_count || 0,
        totalCount: (db.prepare("SELECT total_count FROM tasks WHERE id = ?").get(taskId) as { total_count: number })?.total_count || 0,
        failedCount: (db.prepare("SELECT failed_count FROM tasks WHERE id = ?").get(taskId) as { failed_count: number })?.failed_count || 0,
        queuePosition: -1,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      db.prepare(
        "UPDATE tasks SET status = 'failed', completed_at = datetime('now'), error = ?, queue_position = -1 WHERE id = ?"
      ).run(errorMessage, taskId);

      this.notify({
        taskId,
        status: "failed",
        completedCount: 0,
        totalCount: 0,
        failedCount: 0,
        queuePosition: -1,
      });
    } finally {
      this.processing = false;
      this.processNext();
    }
  }

  private updateQueuePositions(): void {
    for (let i = 0; i < this.queue.length; i++) {
      db.prepare("UPDATE tasks SET queue_position = ? WHERE id = ?").run(i, this.queue[i]);
    }
    // Notify remaining tasks
    for (let i = 0; i < this.queue.length; i++) {
      this.notify({
        taskId: this.queue[i],
        status: "queued",
        completedCount: 0,
        totalCount: 0,
        failedCount: 0,
        queuePosition: i + 1, // front-position ahead
      });
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getQueuePositions(): Map<string, number> {
    const positions = new Map<string, number>();
    this.queue.forEach((id, idx) => positions.set(id, idx + 1));
    return positions;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  /** Returns a notify callback for external use (e.g., retry operations). */
  createNotifyCallback(): ProgressCallback {
    return (payload) => this.notify(payload);
  }
}

export const taskQueue = new TaskQueue();
