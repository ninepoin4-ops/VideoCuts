import { useEffect, useRef, useCallback } from "react";
import type { TaskProgressPayload } from "../types";

type ProgressHandler = (payload: TaskProgressPayload) => void;

export function useSocket(onProgress: ProgressHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const connect = useCallback(() => {
    // Use the current page host (works both locally and over LAN via Vite proxy)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TaskProgressPayload;
        onProgressRef.current(payload);
      } catch {
        // ignore invalid messages
      }
    };

    ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
