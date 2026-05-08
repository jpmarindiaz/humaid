import type { Profile } from "../types";

export default function StatusBar({ profile }: { profile: Profile | null }) {
  return (
    <footer className="flex items-center gap-2 px-4 py-1.5 border-t border-line bg-cream text-[11px] text-muted">
      <span>local-only inference</span>
      <span className="opacity-40">·</span>
      <span>kb: bundled</span>
      {profile && (
        <>
          <span className="opacity-40">·</span>
          <span>region: {profile.region}</span>
        </>
      )}
      <span className="ml-auto opacity-60">v0.1.0</span>
    </footer>
  );
}
