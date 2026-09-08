/**
 * ConnectionIndicator Component
 * ------------------------------
 * Displays the current WebSocket connection state as a subtle indicator
 * in the app header or corner. Shows reconnection attempts and queued
 * events during offline periods.
 */

import { useConnectionStatus } from "../../contexts/websocket.context.js";
import { cn } from "../../lib/utils.js";

interface ConnectionIndicatorProps {
  /** Position of the indicator (default: "top-right") */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Show detailed status text (default: false) */
  showText?: boolean;
  /** Custom className */
  className?: string;
}

export function ConnectionIndicator({
  position = "top-right",
  showText = false,
  className,
}: ConnectionIndicatorProps) {
  const status = useConnectionStatus();

  // Don't show indicator when connected (unless showText is true)
  if (status.connectionState === "connected" && !showText) {
    return null;
  }

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const colorClasses = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    gray: "bg-gray-500",
  };

  return (
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 rounded-lg border border-[#cd7f32]/20 bg-[#0d0d1a] px-3 py-2 shadow-lg",
        positionClasses[position],
        className
      )}
    >
      {/* Status Dot */}
      <div className="relative">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            colorClasses[status.color as keyof typeof colorClasses]
          )}
        />
        {status.pulse && (
          <div
            className={cn(
              "absolute inset-0 h-2 w-2 animate-ping rounded-full",
              colorClasses[status.color as keyof typeof colorClasses],
              "opacity-75"
            )}
          />
        )}
      </div>

      {/* Status Text */}
      {showText && (
        <span className="text-xs font-medium text-[#f4e4c1]">
          {status.text}
        </span>
      )}

      {/* Queued Events Badge */}
      {status.queuedEvents > 0 && (
        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-400">
          {status.queuedEvents} queued
        </span>
      )}
    </div>
  );
}
