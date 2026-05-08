// Typed wrappers around the Tauri IPC commands defined in src-tauri/src/commands.rs.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  Alert,
  AlertEvent,
  DocContent,
  DocSummary,
  KbStats,
  OllamaStatus,
  Profile,
  QaMatch,
  QaRow,
  SystemInfo,
} from "./types";

export async function getProfile(): Promise<Profile | null> {
  return await invoke<Profile | null>("get_profile");
}

export async function setProfile(profile: Profile): Promise<void> {
  await invoke("set_profile", { profile });
}

export async function listQa(opts: {
  role?: string;
  phase?: string;
  region?: string;
  topic?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<QaRow[]> {
  return await invoke<QaRow[]>("list_qa", opts);
}

export async function getQa(id: string): Promise<QaRow | null> {
  return await invoke<QaRow | null>("get_qa", { id });
}

export async function getQaMany(ids: string[]): Promise<QaRow[]> {
  return await invoke<QaRow[]>("get_qa_many", { ids });
}

export async function kbStats(): Promise<KbStats> {
  return await invoke<KbStats>("kb_stats");
}

export async function kbTopics(): Promise<[string, number][]> {
  return await invoke<[string, number][]>("kb_topics");
}

export async function qaSearch(opts: {
  query: string;
  role?: string;
  phase?: string;
  region?: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<QaMatch[]> {
  return await invoke<QaMatch[]>("qa_search", {
    query: opts.query,
    role: opts.role,
    phase: opts.phase,
    region: opts.region,
    limit: opts.limit,
    minSimilarity: opts.minSimilarity,
  });
}

export async function ollamaStatus(): Promise<OllamaStatus> {
  return await invoke<OllamaStatus>("ollama_status");
}

export async function ollamaPullEmbedModel(): Promise<void> {
  await invoke("ollama_pull_embed_model");
}

export async function listAlerts(opts: { region?: string; limit?: number } = {}): Promise<Alert[]> {
  return await invoke<Alert[]>("list_alerts", {
    region: opts.region,
    limit: opts.limit ?? 100,
  });
}

export async function acknowledgeAlert(id: string): Promise<void> {
  await invoke("acknowledge_alert", { id });
}

export async function pollAlertsNow(): Promise<Alert[]> {
  return await invoke<Alert[]>("poll_alerts_now");
}

/** Wipe the local `since` cursor so the next poll returns the full server history. */
export async function refetchAlertHistory(): Promise<Alert[]> {
  return await invoke<Alert[]>("refetch_alert_history");
}

export function onAlertReceived(handler: (e: AlertEvent) => void): Promise<UnlistenFn> {
  return listen<AlertEvent>("alert_received", (e) => handler(e.payload));
}

export async function listDocuments(): Promise<DocSummary[]> {
  return await invoke<DocSummary[]>("list_documents");
}

export async function readDocument(path: string): Promise<DocContent> {
  return await invoke<DocContent>("read_document", { path });
}

export async function systemInfo(): Promise<SystemInfo> {
  return await invoke<SystemInfo>("system_info");
}
