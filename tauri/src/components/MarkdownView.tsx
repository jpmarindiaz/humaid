import { useMemo } from "react";
import { marked } from "marked";

import { openUrl } from "@tauri-apps/plugin-opener";

marked.setOptions({ gfm: true, breaks: false });

export default function MarkdownView({ markdown }: { markdown: string }) {
  const html = useMemo(() => marked.parse(markdown) as string, [markdown]);
  return (
    <div
      className="prose-md"
      // External links should open in the OS browser, not navigate the webview.
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        const a = target.closest("a") as HTMLAnchorElement | null;
        if (a && a.href && /^https?:/i.test(a.href)) {
          e.preventDefault();
          openUrl(a.href).catch(() => {});
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
