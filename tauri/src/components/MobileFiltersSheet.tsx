// Bottom-sheet wrapper around <FiltersBar> for narrow viewports. The same
// chip controls render inside, so behaviour matches desktop exactly.

import { useEffect } from "react";

import FiltersBar from "./FiltersBar";
import type { Language, PhaseFilter, Region, Role } from "../types";

export default function MobileFiltersSheet({
  open,
  onClose,
  role,
  region,
  phase,
  language,
  onRoleChange,
  onRegionChange,
  onPhaseChange,
  onLanguageChange,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  region: Region | "all";
  phase: PhaseFilter;
  language: Language;
  onRoleChange: (r: Role) => void;
  onRegionChange: (r: Region | "all") => void;
  onPhaseChange: (p: PhaseFilter) => void;
  onLanguageChange: (l: Language) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className="relative bg-paper border-t border-line rounded-t-xl px-4 pt-3 pb-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded bg-line mb-3" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Filters</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink px-2 py-0.5 text-lg"
            aria-label="Close"
          >×</button>
        </div>
        <FiltersBar
          role={role}
          region={region}
          phase={phase}
          language={language}
          onRoleChange={onRoleChange}
          onRegionChange={onRegionChange}
          onPhaseChange={onPhaseChange}
          onLanguageChange={onLanguageChange}
        />
      </div>
    </div>
  );
}
