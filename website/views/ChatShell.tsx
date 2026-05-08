/** @jsxImportSource hono/jsx */
// Shell HTML for the React demo client. The bundle lives at /static/chat.js
// and the editorial-light theme CSS at /static/chat.css.
//
// Both are query-suffixed with the deploy id so a fresh deployment
// invalidates browser cache cleanly.

import type { FC } from "hono/jsx";

interface Props { deployId?: string }

export const ChatShell: FC<Props> = ({ deployId = "dev" }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>humaid — demo</title>
      <link rel="canonical" href="https://humaid.app/app" />
      <link rel="stylesheet" href={`/static/chat.css?v=${deployId}`} />
    </head>
    <body>
      <div id="chat-root" data-deploy-id={deployId} />
      <script type="module" src={`/static/chat.js?v=${deployId}`} />
    </body>
  </html>
);
