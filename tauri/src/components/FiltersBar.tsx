import { useEffect, useRef, useState } from "react";

import type { Language, PhaseFilter, Region, Role } from "../types";
import { PHASE_LABELS, REGION_LABELS, ROLE_LABELS } from "../types";

const ROLES: Role[] = [
  "local-community",
  "local-authority",
  "national-authorities",
  "humanitarian-staff",
  "ngos",
  "first-respondants",
];
const REGIONS: (Region | "all")[] = ["all", "la-mojana", "putumayo", "generic"];
const PHASES: PhaseFilter[] = ["all", "pre", "event", "post"];

export default function FiltersBar({
  role,
  region,
  phase,
  language,
  onRoleChange,
  onRegionChange,
  onPhaseChange,
  onLanguageChange,
}: {
  role: Role;
  region: Region | "all";
  phase: PhaseFilter;
  language: Language;
  onRoleChange: (r: Role) => void;
  onRegionChange: (r: Region | "all") => void;
  onPhaseChange: (p: PhaseFilter) => void;
  onLanguageChange: (l: Language) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <ChipMenu
        label="role"
        value={ROLE_LABELS[role]}
        options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        onChange={(v) => onRoleChange(v as Role)}
      />
      <ChipMenu
        label="region"
        value={region === "all" ? "All" : REGION_LABELS[region]}
        options={REGIONS.map((r) => ({
          value: r,
          label: r === "all" ? "All regions" : REGION_LABELS[r],
        }))}
        onChange={(v) => onRegionChange(v as Region | "all")}
      />
      <ChipMenu
        label="phase"
        value={phase === "all" ? "All" : PHASE_LABELS[phase]}
        options={PHASES.map((p) => ({
          value: p,
          label: p === "all" ? "All phases" : PHASE_LABELS[p],
        }))}
        onChange={(v) => onPhaseChange(v as PhaseFilter)}
      />
      <div className="inline-flex rounded-md border border-line bg-soft/60 overflow-hidden text-[11px]">
        {(["es", "en"] as Language[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onLanguageChange(l)}
            className={`px-2 py-1 transition ${
              language === l
                ? "bg-deep text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
          open
            ? "border-line bg-deep text-ink"
            : "border-line bg-soft/60 text-ink-soft hover:border-line hover:text-ink"
        }`}
      >
        <span className="text-muted">{label}:</span>
        <span>{value}</span>
        <span className="text-muted/70">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[200px] rounded-md border border-line bg-paper shadow-lg py-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-xs transition ${
                o.label === value || o.value === value
                  ? "bg-deep text-ink"
                  : "text-ink-soft hover:bg-deep/60 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
