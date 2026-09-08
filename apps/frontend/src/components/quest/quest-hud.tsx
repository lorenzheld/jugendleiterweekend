/**
 * QuestHUD
 * ────────
 * Persistente Bottom-Bar die bis zu 3 aktive Quest-Slots anzeigt.
 * Ein Klick auf einen Slot öffnet das QuestBottomSheet für diese Quest.
 *
 * Positionen / Layout:
 *   • Fixiert am unteren Bildschirmrand (bottom-24 = oberhalb der GPS-Badges)
 *   • Horizontal zentriert, max 3 Karten nebeneinander
 *   • Jede Karte zeigt: Quest-Titel (1 Zeile), aktueller Schritt, Status-Badge
 */

import type { QuestRunDetail } from "@jlw/contracts";

// ── Step action icon lookup ───────────────────────────────────────────────────

function stepIcon(actionType: string): string {
  switch (actionType) {
    case "REACH_LOCATION":
      return "📍";
    case "ANSWER_QUESTION":
      return "❓";
    case "SOLVE_PUZZLE":
      return "🧩";
    case "DEFEAT_ENEMY":
      return "⚔️";
    case "UPLOAD_MEDIA":
      return "📸";
    case "TALK_TO_NPC":
      return "💬";
    default:
      return "▶";
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuestHUDProps {
  runs: QuestRunDetail[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuestHUD({ runs, selectedRunId, onSelectRun }: QuestHUDProps) {
  if (runs.length === 0) return null;

  return (
    <div
      className="absolute bottom-24 left-0 right-0 z-20
                 flex items-end justify-center gap-2 px-3 pb-1"
    >
      {runs.map((run) => {
        const isSelected = run.id === selectedRunId;
        const currentStep = run.currentStep;

        // Progress: how many objectives done?
        const total = run.objectives.filter((o) => o.required).length;
        const done = run.objectives.filter(
          (o) => o.required && o.progress?.status === "COMPLETED",
        ).length;

        const isAllDone = done === total && total > 0;

        return (
          <button
            key={run.id}
            onClick={() => onSelectRun(run.id)}
            className={[
              "flex flex-col gap-0.5 rounded-xl px-3 py-2 text-left transition-all",
              "bg-black/70 backdrop-blur-sm border",
              "max-w-[160px] min-w-[120px]",
              isSelected
                ? "border-[#cd7f32] shadow-[0_0_12px_rgba(205,127,50,0.5)]"
                : "border-white/10 hover:border-[#cd7f32]/60",
              "active:scale-95",
            ].join(" ")}
          >
            {/* Title */}
            <p className="line-clamp-1 text-[11px] font-bold text-[#f4e4c1]">
              {run.questTitle}
            </p>

            {/* Current step */}
            <div className="flex items-center gap-1">
              {currentStep ? (
                <>
                  <span className="text-[11px]">
                    {stepIcon(currentStep.stepActionType)}
                  </span>
                  <span className="line-clamp-1 text-[10px] text-[#cd7f32]">
                    {formatStepLabel(currentStep.stepActionType)}
                  </span>
                </>
              ) : isAllDone ? (
                <span className="text-[10px] text-green-400">
                  ✓ Abschließen
                </span>
              ) : (
                <span className="text-[10px] text-white/40">Kein Schritt</span>
              )}
            </div>

            {/* Progress dots */}
            {total > 0 && (
              <div className="flex gap-0.5 pt-0.5">
                {run.objectives
                  .filter((o) => o.required)
                  .map((o, i) => (
                    <span
                      key={i}
                      className={[
                        "h-1 w-1 rounded-full",
                        o.progress?.status === "COMPLETED"
                          ? "bg-[#cd7f32]"
                          : "bg-white/20",
                      ].join(" ")}
                    />
                  ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStepLabel(actionType: string): string {
  switch (actionType) {
    case "REACH_LOCATION":
      return "Ort erreichen";
    case "ANSWER_QUESTION":
      return "Frage beantworten";
    case "SOLVE_PUZZLE":
      return "Rätsel lösen";
    case "DEFEAT_ENEMY":
      return "Kampf!";
    case "UPLOAD_MEDIA":
      return "Foto hochladen";
    case "TALK_TO_NPC":
      return "Mit NPC sprechen";
    case "ACCEPT_QUEST":
      return "Quest annehmen";
    default:
      return actionType.toLowerCase().replace(/_/g, " ");
  }
}
