const BASE = "/api";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const hasBody = !!options?.body;
  const res = await fetch(`${BASE}${url}`, {
    headers: hasBody
      ? { "Content-Type": "application/json", ...options?.headers }
      : { ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── Tasks ─────────────────────────────────────────────

export function listTasks() {
  return request<import("../types").TaskItem[]>("/tasks");
}

export function getTask(id: string) {
  return request<import("../types").TaskItem>(`/tasks/${id}`);
}

export function createTask(data: import("../types").CreateTaskRequest) {
  return request<import("../types").TaskItem>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function startTask(id: string) {
  return request<{ ok: boolean; queuePosition: number }>(`/tasks/${id}/start`, {
    method: "POST",
  });
}

export function deleteTask(id: string) {
  return request<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" });
}

export function retryRender(taskId: string, renderIndex: number) {
  return request(`/tasks/${taskId}/results/${renderIndex}/retry`, {
    method: "POST",
  });
}

export function getQueue() {
  return request<{
    queueLength: number;
    isProcessing: boolean;
    positions: { taskId: string; queuePosition: number }[];
  }>("/queue");
}

// ─── Templates ─────────────────────────────────────────

export function listTemplates() {
  return request<import("../types").Template[]>("/templates");
}

export function getTemplate(id: string) {
  return request<import("../types").Template>(`/templates/${id}`);
}

export function createTemplate(data: import("../types").CreateTemplateRequest) {
  return request<{ id: string; totalDuration: number }>("/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTemplate(id: string, data: import("../types").UpdateTemplateRequest) {
  return request<{ ok: boolean }>(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(id: string) {
  return request<{ ok: boolean }>(`/templates/${id}`, { method: "DELETE" });
}

// ─── Materials ─────────────────────────────────────────

export function listMaterials() {
  return request<import("../types").MaterialLibItem[]>("/materials");
}

export async function uploadMaterial(file: File, folderName: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folderName", folderName);

  const res = await fetch(`${BASE}/materials/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "Upload failed");
  }

  return res.json();
}

export function deleteMaterial(id: string) {
  return request<{ ok: boolean }>(`/materials/${id}`, { method: "DELETE" });
}

// ─── Upload ────────────────────────────────────────────

export async function uploadVideo(
  file: File,
  slotType: string,
  groupName: string
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("slotType", slotType);
  formData.append("groupName", groupName);

  const res = await fetch(`${BASE}/upload/videos`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "Upload failed");
  }

  return res.json();
}

export async function uploadBgm(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/upload/bgm`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("BGM upload failed");
  return res.json();
}

export async function uploadTexts(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/upload/texts`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Text upload failed");
  return res.json() as Promise<import("../types").ParsedTextFile>;
}
