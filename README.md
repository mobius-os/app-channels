# Channels

The places outside Möbius it posts to: Slack, Discord, ntfy or any webhook.

Each channel can get two kinds of messages:

- **Notification copies.** A copy of the owner's notifications is sent
  exactly when a phone would get them, never while the owner is looking at
  that app. A channel can follow every app or only some, and can send titles
  only (the default) or the text too.
- **Posts.** Messages the owner's agents send on purpose when asked, such as
  release notes or a weekly summary. A channel accepts them only when its
  **Allow posts** switch is on.

The platform keeps what an app should not hold. It stores each link
encrypted and never returns it, checks it is a public https address, formats
each service's message so nobody can be @mentioned, and does the sending.
This app is the owner's window onto that, authorized by the
`channels_manage` manifest permission. It manages channels without ever
seeing a link.

## What it does

- A guided add for each service, with the steps to get the link, a check
  that the link isn't cut off, and a test message.
- Per channel: health (last delivery or the service's error), both feeds,
  recent sends (titles and outcomes only), send test, replace link, remove.
- A skill (`channels.md`) that tells agents how to post to a channel.

## Tests

`npm test` runs the request helpers' tests with Node, then the app itself in
headless Chromium against a fake server (`test/channels-browser.mjs`). The
browser test builds with the Möbius shell's own Rolldown and React: on a
Möbius host it finds them, elsewhere set `MOBIUS_FRONTEND_NODE_MODULES` to a
Möbius checkout's `frontend/node_modules`. `--screenshots DIR` also saves
what each width shows at the end.
