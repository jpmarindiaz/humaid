/** @jsxImportSource hono/jsx */
// Shell HTML for the React chat client. The client is bundled to
// /static/chat.js; Tailwind output to /static/styles.css.

import type { FC } from "hono/jsx";

export const ChatShell: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>humaid — try the demo</title>
      <link rel="stylesheet" href="/static/styles.css" />
    </head>
    <body class="bg-zinc-950 text-zinc-100 antialiased">
      <div id="chat-root" />
      <script type="module" src="/static/chat.js" />
    </body>
  </html>
);
