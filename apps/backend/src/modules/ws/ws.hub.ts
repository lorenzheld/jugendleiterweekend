/**
 * WebSocket Hub
 * ─────────────
 * Manages team-based WebSocket rooms for the Via Romae game server.
 *
 * Architecture:
 *   - One room per teamId (Map<teamId, Set<WebSocket>>).
 *   - Players connect to GET /api/v1/geo/ws with a JWT token (query param).
 *   - On radius zone transitions the geo service calls broadcast() to
 *     push RadiusEvent payloads to all team members simultaneously.
 *
 * Design decisions:
 *   - In-process hub is fine for ≤13 players; no Redis needed.
 *   - WebSocket authentication uses the JWT query-param pattern because
 *     browsers cannot set Authorization headers on WS upgrades.
 *   - A custom ping/pong keeps connections alive over flaky mobile networks.
 */

import type { WebSocket } from "@fastify/websocket";
import type { FastifyBaseLogger } from "fastify";
import type { RadiusEvent } from "@jlw/contracts";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Ping interval in milliseconds (keeps NAT/mobile connections alive). */
const PING_INTERVAL_MS = 25_000;

// ── WsHub ─────────────────────────────────────────────────────────────────────

export class WsHub {
  /** team rooms: teamId → set of active WebSocket connections */
  private rooms = new Map<string, Set<WebSocket>>();

  /** Reverse lookup: socket → teamId (for fast cleanup on disconnect) */
  private socketTeam = new Map<WebSocket, string>();

  /** Heartbeat timer handle */
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly logger: FastifyBaseLogger) {
    this.startHeartbeat();
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a WebSocket connection into a team room.
   * Automatically removes it when the socket closes.
   */
  register(ws: WebSocket, teamId: string): void {
    if (!this.rooms.has(teamId)) {
      this.rooms.set(teamId, new Set());
    }
    this.rooms.get(teamId)!.add(ws);
    this.socketTeam.set(ws, teamId);

    this.logger.info({ teamId }, "ws: client registered");

    // Auto-cleanup on close or error
    const cleanup = (): void => this.unregister(ws);
    ws.on("close", cleanup);
    ws.on("error", (err: Error) => {
      this.logger.warn({ teamId, err }, "ws: socket error");
      cleanup();
    });
  }

  /**
   * Remove a WebSocket connection from its team room.
   * Safe to call multiple times.
   */
  unregister(ws: WebSocket): void {
    const teamId = this.socketTeam.get(ws);
    if (!teamId) return;

    this.socketTeam.delete(ws);
    const room = this.rooms.get(teamId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) this.rooms.delete(teamId);
    }

    this.logger.info({ teamId }, "ws: client unregistered");
  }

  // ── Broadcasting ─────────────────────────────────────────────────────────────

  /**
   * Send any serialisable event to all connected members of a team.
   * Used by quest, combat, and other modules that emit team-scoped events
   * without being tied to the RadiusEvent shape.
   *
   * Silently skips sockets that are no longer OPEN.
   */
  sendToTeam<T>(teamId: string, event: T): void {
    const room = this.rooms.get(teamId);
    if (!room || room.size === 0) return;

    const payload = JSON.stringify(event);
    let sent = 0;

    for (const ws of room) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
        sent++;
      }
    }

    this.logger.debug({ teamId, sent }, "ws: sendToTeam");
  }

  /**
   * Send a RadiusEvent to all connected members of a team.
   * Silently skips sockets that are no longer OPEN.
   */
  broadcastToTeam(teamId: string, event: RadiusEvent): void {
    const room = this.rooms.get(teamId);
    if (!room || room.size === 0) return;

    const payload = JSON.stringify(event);
    let sent = 0;

    for (const ws of room) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
        sent++;
      }
    }

    this.logger.debug(
      { teamId, event: event.event, sent, roomSize: room.size },
      "ws: broadcast",
    );
  }

  /**
   * Broadcast a RadiusEvent to ALL connected clients regardless of team.
   * Used for global BOSS_JOIN events.
   */
  broadcastAll(event: RadiusEvent): void {
    const payload = JSON.stringify(event);
    let sent = 0;

    for (const room of this.rooms.values()) {
      for (const ws of room) {
        if (ws.readyState === ws.OPEN) {
          ws.send(payload);
          sent++;
        }
      }
    }

    this.logger.debug({ event: event.event, sent }, "ws: broadcastAll");
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────────

  /** Number of currently connected clients. */
  get connectionCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.size;
    return total;
  }

  /** Snapshot of room sizes for health/debug endpoints. */
  getRoomStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [teamId, room] of this.rooms.entries()) {
      stats[teamId] = room.size;
    }
    return stats;
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────────

  /**
   * Sends a WebSocket ping frame to every open connection.
   * Closes stale sockets that don't respond (browser handles pong automatically).
   */
  private startHeartbeat(): void {
    this.pingTimer = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const ws of room) {
          if (ws.readyState === ws.OPEN) {
            ws.ping();
          } else {
            // Already closed – remove on next cleanup cycle
            this.unregister(ws);
          }
        }
      }
    }, PING_INTERVAL_MS);

    // Don't block process exit
    if (this.pingTimer.unref) this.pingTimer.unref();
  }

  /** Stop the heartbeat timer (called on server shutdown). */
  destroy(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
