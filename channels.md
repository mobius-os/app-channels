# Posting to outside channels

Read this when the partner asks you to post, share, announce or send something
to Slack, Discord, ntfy or a webhook (a release note, a status update, a
summary for their team), or asks which outside places Möbius posts to.

## What a channel is

A channel is a Slack, Discord, ntfy or webhook link the partner added in the
**Channels** app (slug `channels`). Möbius keeps the link encrypted and never
returns it, so you never handle the secret. Each channel has two switches:

- **Copy notifications** — it gets a copy of the partner's notifications,
  exactly when their phone would (optionally only some apps', with or without
  the text). This happens by itself; you do nothing.
- **Allow posts** — you may post to it on purpose when the partner asks.

## Posting

List the channels, then post to one by its id. Your chat token works; a
delegated helper is refused, so post from the top-level chat.

```bash
mapi /api/channels | python3 -c 'import json,sys; [print(c["id"], c["label"], c["kind"], "posts" if c["acceptPosts"] else "no-posts") for c in json.load(sys.stdin)]'

mapi -X POST /api/channels/<id>/send -H 'Content-Type: application/json' \
  -d '{"title": "Released v1.2", "text": "• Faster search\n• Fixed sign-in on phones", "link": "https://github.com/org/repo/releases/tag/v1.2"}'
```

- `title` (required, up to 200 characters) is shown in bold. `text` is
  optional, up to 3000 characters. `link` is optional: a Möbius page such as
  `/shell/?app=12` (shown as "Open in Möbius") or any `https://` address
  (shown as "Open link").
- The answer is `{"ok": true, "error": null}`, or `ok: false` with the
  service's reason. Report a failure to the partner. Don't retry blindly.
- Formatting is kept. Use Slack's `*bold*` and `•` bullets for Slack, and
  `**bold**` for Discord. Nobody can be @mentioned: `@channel`, `@everyone` and
  `<!here>` are never delivered as pings.
- When to post: a post speaks to other people under the partner's name. Send
  only what they asked you to post, or a draft they approved. Never include
  secrets, tokens or private details they didn't ask to share.

If a channel answers **409** ("doesn't accept posts"), don't turn **Allow
posts** on yourself unless the partner asked you to. Tell them, and offer to
open Channels with the `open_item` tool so they can switch it on.

## Adding and changing channels

The partner adds a link in Channels: it walks them through getting the link
from each service and sends a test. A webhook link works like a password, so
never ask them to paste it into chat. Point them to the app. When they ask
you to change a channel's settings, use
`PATCH /api/channels/<id>` with any of `label`, `copy_notifications`,
`app_ids` (a list of app ids), `all_notifications: true`, `include_body` and
`accept_posts`. `GET /api/channels/<id>/activity` lists its recent sends:
titles and outcomes only.
