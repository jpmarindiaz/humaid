import { useState } from "react";

import { setProfile as saveProfile } from "../api";
import type { Language, Profile, Region, Role } from "../types";
import { REGION_LABELS, ROLE_LABELS } from "../types";

const ROLES: Role[] = [
  "local-community",
  "local-authority",
  "national-authorities",
  "humanitarian-staff",
  "ngos",
  "first-respondants",
];

const REGIONS: Region[] = ["la-mojana", "putumayo", "generic"];

export default function ProfileSetup({ onSave }: { onSave: (p: Profile) => void }) {
  const [role, setRole] = useState<Role>("first-respondants");
  const [region, setRegion] = useState<Region>("la-mojana");
  const [language, setLanguage] = useState<Language>("es");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const p: Profile = { role, region, language };
      await saveProfile(p);
      onSave(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-y-auto h-full">
      <form
        onSubmit={submit}
        className="max-w-xl mx-auto px-6 py-12 space-y-7"
      >
        <div>
          <h2 className="text-2xl font-serif font-semibold tracking-tight">Welcome to humaid</h2>
          <p className="text-sm text-muted mt-1">
            Tell us who you are and where you work. This biases everything you'll
            see — you can change it later from the top bar.
          </p>
        </div>

        <Fieldset legend="Your role">
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <Option
                key={r}
                active={role === r}
                onClick={() => setRole(r)}
                label={ROLE_LABELS[r]}
              />
            ))}
          </div>
        </Fieldset>

        <Fieldset legend="Region you cover">
          <div className="grid grid-cols-3 gap-2">
            {REGIONS.map((r) => (
              <Option
                key={r}
                active={region === r}
                onClick={() => setRegion(r)}
                label={REGION_LABELS[r]}
              />
            ))}
          </div>
        </Fieldset>

        <Fieldset legend="Preferred language">
          <div className="grid grid-cols-2 gap-2">
            <Option active={language === "es"} onClick={() => setLanguage("es")} label="Español" />
            <Option active={language === "en"} onClick={() => setLanguage("en")} label="English" />
          </div>
        </Fieldset>

        {err && (
          <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-md bg-terracotta text-paper text-sm font-medium hover:bg-terracotta-deep disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0 m-0 space-y-2">
      <legend className="text-[10px] tracking-[0.08em] uppercase text-muted">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function Option({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left text-sm px-3 py-2.5 rounded-md border transition ${
        active
          ? "border-terracotta bg-terracotta/10 text-ink"
          : "border-line bg-soft/60 text-ink-soft hover:border-line hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
