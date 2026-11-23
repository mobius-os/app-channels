// The services a channel can be, how to get each one's link, and their marks.
// The link shapes match the server's own check; checking here only gives
// earlier feedback while the owner pastes.

export const SERVICES = [
  {
    kind: 'slack',
    name: 'Slack',
    placeholder: 'https://hooks.slack.com/services/…',
    // The same shapes the server checks; this only gives earlier feedback.
    complete: /^https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{8,}\/?$/,
    incomplete: 'This Slack link looks cut off. Use the Copy button next to your channel’s webhook.',
    steps: [
      <>Open <b>api.slack.com/apps</b> and choose <b>Create New App</b> → <b>From scratch</b>. Name it Möbius and pick your workspace.</>,
      <>In the app’s menu open <b>Incoming Webhooks</b> and switch it <b>On</b>. No scopes are needed.</>,
      <>Scroll down, click <b>Add New Webhook</b>, pick a channel and <b>Allow</b>. If Slack asks for approval, a workspace admin must approve it.</>,
      <>Click <b>Copy</b> next to the new link starting with hooks.slack.com/services/. Ignore Slack’s “agent setup” prompt.</>,
    ],
  },
  {
    kind: 'discord',
    name: 'Discord',
    placeholder: 'https://discord.com/api/webhooks/…',
    complete: /^https:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{8,}\/?$/,
    incomplete: 'This Discord link looks cut off. Use Copy Webhook URL in Discord.',
    steps: [
      <>In Discord, open the channel’s <b>Edit Channel</b> → <b>Integrations</b> → <b>Webhooks</b>. You need the Manage Webhooks permission.</>,
      <>Click <b>New Webhook</b>, then <b>Copy Webhook URL</b>.</>,
    ],
  },
  {
    kind: 'ntfy',
    name: 'ntfy',
    placeholder: 'https://ntfy.sh/your-topic',
    complete: /^https:\/\/[^/\s]+(\/[^/\s]+)*\/[A-Za-z0-9_-]+\/?$/,
    incomplete: 'Add your topic to the link, like https://ntfy.sh/your-topic.',
    steps: [
      <>Install the <b>ntfy</b> app on your phone and subscribe to a hard-to-guess topic.</>,
      <>Paste <b>https://ntfy.sh/</b> followed by that topic.</>,
    ],
  },
  {
    kind: 'webhook',
    name: 'Webhook',
    placeholder: 'https://example.com/hook',
    complete: /^https:\/\/\S+$/,
    incomplete: 'Use the full https:// address.',
    steps: [
      <>Paste any <b>https</b> address that accepts a JSON POST. Möbius sends the title, a link back, the source, and the message text if you allow it.</>,
    ],
  },
]
export const SERVICE = Object.fromEntries(SERVICES.map((service) => [service.kind, service]))

export function ServiceIcon({ kind, size = 20 }) {
  if (kind === 'slack') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <rect x="3" y="9.5" width="8" height="3.2" rx="1.6" fill="#36C5F0" />
        <rect x="9.5" y="3" width="3.2" height="8" rx="1.6" fill="#2EB67D" />
        <rect x="13" y="11.3" width="8" height="3.2" rx="1.6" fill="#ECB22E" />
        <rect x="11.3" y="13" width="3.2" height="8" rx="1.6" fill="#E01E5A" />
      </svg>
    )
  }
  if (kind === 'discord') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="6" fill="#5865F2" />
        <circle cx="9" cy="12.5" r="1.7" fill="#fff" />
        <circle cx="15" cy="12.5" r="1.7" fill="#fff" />
      </svg>
    )
  }
  if (kind === 'ntfy') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#2C9C6E" />
        <path d="M12 6.5a4 4 0 0 0-4 4v3l-1.3 1.8h10.6L16 13.5v-3a4 4 0 0 0-4-4Zm-1.6 10h3.2a1.6 1.6 0 0 1-3.2 0Z" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  )
}

export function detectKind(url) {
  try {
    const { hostname, pathname } = new URL(url.trim())
    if (hostname === 'hooks.slack.com') return 'slack'
    if (/(^|\.)discord(app)?\.com$/.test(hostname) && pathname.includes('/api/webhooks/')) return 'discord'
    if (hostname === 'ntfy.sh') return 'ntfy'
  } catch {
    // Not a URL yet.
  }
  return null
}
