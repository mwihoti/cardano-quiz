import { type ServerMsg } from "@/types";

type Handler = (msg: ServerMsg) => void;

class GameSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  public socketId: string | null = null;

  constructor() {
    this.url = this.buildUrl();
  }

  private buildUrl(): string {
    // Explicit override for split deployments (frontend on Vercel, backend on Render)
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev, Vite proxies /ws → server:5000/ws
    return `${proto}//${window.location.host}/ws`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMsg = JSON.parse(event.data);
        if (msg.type === "CONNECTED") this.socketId = msg.socketId;
        this.handlers.forEach((h) => h(msg));
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      this.ws = null;
      // Auto reconnect after 2s
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }
}

// Singleton used across the app
export const gameSocket = new GameSocket();
