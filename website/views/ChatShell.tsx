/** @jsxImportSource hono/jsx */
// Shell HTML for the React demo client. The bundle lives at /static/chat.js
// and the editorial-light theme CSS at /static/chat.css.

import type { FC } from "hono/jsx";

export const ChatShell: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>humaid — demo</title>
      <link rel="stylesheet" href="/static/chat.css" />
    </head>
    <body>
      <div id="chat-root" />
      <script type="module" src="/static/chat.js" />
    </body>
  </html>
);
