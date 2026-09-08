/**
 * WebSocketContext
 * ----------------
 * Provides global WebSocket connection state and event handlers to the
 * entire React tree. Automatically manages connection lifecycle based on
 * authentication state.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useWebSocket,
  type WsEvent,
  type EventHandler,
  type ConnectionState,
} from "../hooks/use-websocket.js";
import type { RadiusEvent, WsConnectedEvent } from "@jlw/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebSocketContextValue {
  connectionState: ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  reconnectAttempts: number;
  queuedEvents: number;
  
  /** Subscribe to all events or a specific event type */
  subscribe: <T extends WsEvent = WsEvent>(
    handler: EventHandler<T>,
    eventTypeFilter?: string
  ) => () => void;
  
  /** Send a message through the WebSocket (queues if offline) */
  send: <T = unknown>(data: T) => boolean;
  
  /** Manually trigger reconnect */
  reconnect: () => void;
  
  /** Manually disconnect */
  disconnect: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface WebSocketProviderProps {
  children: React.ReactNode;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Enable event recovery after reconnect (default: true) */
  enableRecovery?: boolean;
}

export function WebSocketProvider({
  children,
  debug = false,
  autoReconnect = true,
  enableRecovery = true,
}: WebSocketProviderProps) {
  const ws = useWebSocket({
    autoReconnect,
    enableRecovery,
    debug,
  });

  const [connectionNotified, setConnectionNotified] = useState(false);

  // Log connection state changes
  useEffect(() => {
    if (debug) {
      console.log("[WS Context] Connection state:", ws.connectionState);
    }

    // Show toast notification on successful reconnection
    if (ws.isConnected && ws.reconnectAttempts > 0 && !connectionNotified) {
      console.log("✓ Verbindung wiederhergestellt");
      setConnectionNotified(true);
    }

    // Reset notification flag when disconnected
    if (!ws.isConnected) {
      setConnectionNotified(false);
    }
  }, [ws.connectionState, ws.isConnected, ws.reconnectAttempts, debug, connectionNotified]);

  // Log errors
  useEffect(() => {
    if (ws.lastError) {
      console.error("[WS Context] Error:", ws.lastError);
    }
  }, [ws.lastError]);

  const value = useMemo<WebSocketContextValue>(
    () => ({
      connectionState: ws.connectionState,
      isConnected: ws.isConnected,
      isConnecting: ws.isConnecting,
      lastError: ws.lastError,
      reconnectAttempts: ws.reconnectAttempts,
      queuedEvents: ws.queuedEvents,
      subscribe: ws.subscribe,
      send: ws.send,
      reconnect: ws.connect,
      disconnect: ws.disconnect,
    }),
    [ws]
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Convenience hook – throws if used outside <WebSocketProvider>. */
export function useWs(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWs must be used inside <WebSocketProvider>");
  }
  return ctx;
}

// ── Specialized Hooks ─────────────────────────────────────────────────────────

/**
 * Subscribe to a specific event type with type-safe handler.
 * Automatically unsubscribes on unmount.
 */
export function useWsEvent<T extends WsEvent = WsEvent>(
  eventType: string,
  handler: EventHandler<T>
): void {
  const { subscribe } = useWs();

  useEffect(() => {
    const unsubscribe = subscribe<T>(handler, eventType);
    return unsubscribe;
  }, [subscribe, eventType, handler]);
}

/**
 * Subscribe to radius transition events.
 * Common use case: updating map markers when players enter/exit zones.
 */
export function useRadiusEvents(
  handler: EventHandler<RadiusEvent>
): void {
  useWsEvent("radius.transition", handler);
}

/**
 * Subscribe to the initial WebSocket connected event.
 * Provides nearby objects snapshot on connection.
 */
export function useWsConnected(
  handler: EventHandler<WsConnectedEvent>
): void {
  useWsEvent("ws.connected", handler);
}

/**
 * Hook for connection status indicator UI.
 * Returns connection state and styled indicator props.
 */
export function useConnectionStatus() {
  const { connectionState, reconnectAttempts, queuedEvents } = useWs();

  const indicator = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return {
          color: "green",
          text: "Verbunden",
          icon: "✓",
          pulse: false,
        };
      case "connecting":
        return {
          color: "yellow",
          text: "Verbinde...",
          icon: "↻",
          pulse: true,
        };
      case "reconnecting":
        return {
          color: "orange",
          text: `Wiederverbinde (${reconnectAttempts})...`,
          icon: "↻",
          pulse: true,
        };
      case "disconnected":
        return {
          color: "gray",
          text: "Getrennt",
          icon: "○",
          pulse: false,
        };
      case "error":
        return {
          color: "red",
          text: "Fehler",
          icon: "✗",
          pulse: false,
        };
      default:
        return {
          color: "gray",
          text: "Unbekannt",
          icon: "?",
          pulse: false,
        };
    }
  }, [connectionState, reconnectAttempts]);

  return {
    connectionState,
    reconnectAttempts,
    queuedEvents,
    ...indicator,
  };
}
