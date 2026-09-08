/**
 * WebSocket Event Log Cleanup
 * ----------------------------
 * Background job that prunes old events from the ws_event_log table.
 * Events older than 5 minutes are deleted to prevent unbounded growth.
 * 
 * Run this periodically (e.g., every minute via a cron job or setInterval).
 */

import { db } from "../../db/client.js";
import { wsEventLog } from "../../db/schema/index.js";
import { lt } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";

/** How long to retain events (in milliseconds) */
const RETENTION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** How often to run cleanup (in milliseconds) */
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class WsEventCleanup {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly logger: FastifyBaseLogger) {}

  /**
   * Start the cleanup job.
   * Runs immediately and then every CLEANUP_INTERVAL_MS.
   */
  start(): void {
    if (this.timer) {
      this.logger.warn("WS cleanup already started");
      return;
    }

    this.logger.info("Starting WS event cleanup job");

    // Run immediately
    void this.cleanup();

    // Then run periodically
    this.timer = setInterval(() => {
      void this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // Don't block process exit
    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Stop the cleanup job.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info("Stopped WS event cleanup job");
    }
  }

  /**
   * Delete events older than RETENTION_WINDOW_MS.
   */
  private async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_WINDOW_MS);

    try {
      const result = await db
        .delete(wsEventLog)
        .where(lt(wsEventLog.timestamp, cutoff));

      // Drizzle returns { count: number } for deletes
      const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0;

      if (deleted > 0) {
        this.logger.debug({ deleted, cutoff }, "Cleaned up old WS events");
      }
    } catch (error) {
      this.logger.error({ error }, "Failed to cleanup WS events");
    }
  }
}
