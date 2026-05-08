import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

import * as api from "./api";
import type {
  Alert,
  AlertEvent,
  Language,
  PhaseFilter,
  Profile,
  Region,
  Role,
} from "./types";
import ProfileSetup from "./components/ProfileSetup";
import Documents from "./components/Documents";
import Chat from "./components/Chat";
import StatusBar from "./components/StatusBar";
import FiltersBar from "./components/FiltersBar";
import ModelsInfo from "./components/ModelsInfo";
import { useAlertPolling } from "./hooks/useAlertPolling";
import { useIsMobile } from "./hooks/useIsMobile";

// Alerts pulls in mapbox-gl (~1.5 MB) — keep it out of the initial bundle.
const Alerts = lazy(() => import("./components/Alerts"));

type Tab = "chat" | "docs" | "alerts";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);
  const [unseenAlerts, setUnseenAlerts] = useState(0);
  const [chatDocPath, setChatDocPath] = useState<string | null>(null);
  const [docsInitialPath, setDocsInitialPath] = useState<string | null>(null);

  const isMobile = useIsMobile();

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p);
      setProfileLoaded(true);
      if (p) setRegionFilter(p.region);
    });
    api.listAlerts({ limit: 1 }).then((items) => {
      if (items.length > 0) setLatestAlert(items[0]);
    });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    api.onAlertReceived((e: AlertEvent) => {
      setLatestAlert(e.alert);
      setUnseenAlerts((n) => n + 1);
    }).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  useAlertPolling({ active: !!profile, tab });

  const onTabChange = useCallback((t: Tab) => {
    setTab(t);
    if (t === "alerts") setUnseenAlerts(0);
  }, []);

  const language = profile?.language ?? "es";

  const onRoleChange = useCallback((r: Role) => {
    if (!profile) return;
    const next = { ...profile, role: r };
    setProfile(next);
    api.setProfile(next).catch(() => {});
  }, [profile]);

  const onLanguageChange = useCallback((l: Language) => {
    if (!profile) return;
    const next = { ...profile, language: l };
    setProfile(next);
    api.setProfile(next).catch(() => {});
  }, [profile]);

  const onRegionChange = useCallback((r: Region | "all") => {
    setRegionFilter(r);
    if (r !== "all" && profile && profile.region !== r) {
      const next = { ...profile, region: r as Region };
      setProfile(next);
      api.setProfile(next).catch(() => {});
    }
  }, [profile]);

  const openDocInChat = useCallback((path: string) => {
    if (isMobile) {
      // On mobile, the right pane is hidden — push the doc into the Documents tab instead.
      setDocsInitialPath(path);
      setTab("docs");
    } else {
      setChatDocPath(path);
    }
  }, [isMobile]);

  const openDocInTab = useCallback((path: string) => {
    setDocsInitialPath(path);
    setTab("docs");
  }, []);

  const main = useMemo(() => {
    if (!profileLoaded) {
      return <div className="p-6 text-muted text-sm">Loading…</div>;
    }
    if (!profile) {
      return (
        <ProfileSetup
          onSave={(p) => {
            setProfile(p);
            setRegionFilter(p.region);
          }}
        />
      );
    }
    if (tab === "chat") {
      return (
        <Chat
          profile={profile}
          language={language}
          phase={phase}
          regionFilter={regionFilter}
          openDocPath={isMobile ? null : chatDocPath}
          onOpenDoc={openDocInChat}
          onCloseDoc={() => setChatDocPath(null)}
          onOpenDocInTab={openDocInTab}
        />
      );
    }
    if (tab === "docs") {
      return (
        <Documents
          language={language}
          initialPath={docsInitialPath}
        />
      );
    }
    return (
      <Suspense fallback={<div className="p-6 text-muted text-sm">Loading alert view…</div>}>
        <Alerts profile={profile} language={language} regionFilter={regionFilter} />
      </Suspense>
    );
  }, [profile, profileLoaded, tab, language, phase, regionFilter, chatDocPath, docsInitialPath, openDocInChat, openDocInTab, isMobile]);

  // Alerts safety-net redirect: if regionFilter changes and main rebuilds,
  // we don't want to keep "all" → mismatched profile, but the existing
  // onRegionChange handles that.

  return (
    <div className="grid grid-rows-[auto_auto_1fr_auto] h-screen bg-cream text-ink">
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b border-line bg-cream/95 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-2 mr-1">
          <span className="block w-2.5 h-2.5 rounded-full bg-terracotta ring-2 ring-terracotta/30" />
          <span className="text-base font-serif font-semibold tracking-tight">humaid</span>
        </div>

        {profile && (
          <>
            {/* Desktop top tabs */}
            <nav className="hidden md:flex gap-0.5">
              <TabButton active={tab === "chat"} onClick={() => onTabChange("chat")}>Chat</TabButton>
              <TabButton active={tab === "docs"} onClick={() => onTabChange("docs")}>Documents</TabButton>
              <TabButton
                active={tab === "alerts"}
                onClick={() => onTabChange("alerts")}
                badge={unseenAlerts}
              >
                Alerts
              </TabButton>
            </nav>

            <div className="hidden md:block h-5 w-px bg-deep mx-1" />

            {/* Desktop inline filters */}
            <div className="hidden md:block">
              <FiltersBar
                role={profile.role}
                region={regionFilter}
                phase={phase}
                language={language}
                onRoleChange={onRoleChange}
                onRegionChange={onRegionChange}
                onPhaseChange={setPhase}
                onLanguageChange={onLanguageChange}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ModelsInfo />
              <button
                type="button"
                onClick={() => setProfile(null)}
                title="Re-run setup"
                className="hidden md:inline-block text-[11px] text-muted hover:text-ink px-2 py-1 rounded border border-line transition"
              >
                reset profile
              </button>
            </div>
          </>
        )}
      </header>

      {/* Mobile filters bar — pinned just below the brand header so chip
          dropdowns open downward into the content area, not into a cramped
          bottom sheet. */}
      {profile && (
        <div className="md:hidden border-b border-line bg-cream/90 backdrop-blur sticky top-[42px] z-10 px-3 py-2">
          <FiltersBar
            role={profile.role}
            region={regionFilter}
            phase={phase}
            language={language}
            onRoleChange={onRoleChange}
            onRegionChange={onRegionChange}
            onPhaseChange={setPhase}
            onLanguageChange={onLanguageChange}
          />
        </div>
      )}

      {latestAlert && profile && tab !== "alerts" ? (
        <button
          type="button"
          onClick={() => onTabChange("alerts")}
          className={`flex items-center gap-2 px-4 py-2 text-sm border-b text-left transition ${
            latestAlert.severity === "severe"
              ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
              : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          }`}
        >
          <strong className="font-semibold">Flood alert</strong>
          <span className="opacity-90">
            · {latestAlert.region.replace("-", " ")} · {latestAlert.severity}
          </span>
          <span className="ml-auto opacity-70">view →</span>
        </button>
      ) : (
        <div className="hidden" />
      )}

      <main className="overflow-hidden">{main}</main>

      {/* Mobile bottom tab bar */}
      {profile && (
        <nav className="md:hidden flex border-t border-line bg-cream">
          <BottomTab active={tab === "chat"} onClick={() => onTabChange("chat")} icon="💬" label="Chat" />
          <BottomTab active={tab === "docs"} onClick={() => onTabChange("docs")} icon="📄" label="Docs" />
          <BottomTab active={tab === "alerts"} onClick={() => onTabChange("alerts")} icon="📡" label="Alerts" badge={unseenAlerts} />
        </nav>
      )}

      <div className="hidden md:block">
        <StatusBar profile={profile} />
      </div>

    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-1.5 text-sm rounded-md transition ${
        active
          ? "bg-paper text-ink"
          : "text-muted hover:text-ink hover:bg-soft"
      }`}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="ml-1.5 inline-block min-w-[18px] text-center bg-terracotta text-paper text-[10px] px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function BottomTab({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 flex flex-col items-center justify-center gap-0.5 text-[11px] transition ${
        active ? "text-terracotta" : "text-muted"
      }`}
    >
      <span className="text-lg leading-none relative">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -right-3 inline-block min-w-[16px] text-center bg-terracotta text-paper text-[9px] px-1 py-0.5 rounded-full">
            {badge}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </button>
  );
}
