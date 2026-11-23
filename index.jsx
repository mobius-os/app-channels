// Channels — the places outside Möbius it posts to: Slack, Discord, ntfy or any
// webhook. Each channel can copy owner notifications (exactly when a phone
// would get them) and can accept posts sent on purpose, such as release notes.
// The platform keeps the links encrypted and does the sending; this app is the
// owner's window onto them. Components are module-level so a background refresh
// of the list never remounts a half-filled form.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from '@openai/apps-sdk-ui/components/Icon'
import { CSS } from './theme.js'
import { SERVICES, SERVICE, ServiceIcon, detectKind } from './services.jsx'
import {
  addChannel, channelActivity, listApps, listChannels, removeChannel, testChannel, updateChannel,
} from './api.js'

/* ── small helpers ─────────────────────────────────────────────────────── */

function ago(iso) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })
  if (minutes < 1) return rtf.format(0, 'minute')
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function health(channel) {
  if (channel.lastError) return { tone: 'bad', text: channel.lastError }
  if (channel.lastSentAt) return { tone: 'ok', text: `Delivered ${ago(channel.lastSentAt)}` }
  return { tone: 'idle', text: 'Nothing sent yet' }
}

function scopeText(appIds, appNames) {
  if (appIds == null) return 'All notifications'
  const names = appIds.map((id) => appNames.get(id)).filter(Boolean)
  if (!names.length) return 'No apps chosen'
  return names.length <= 2 ? names.join(', ') : `${names.length} apps`
}

const SOURCE_NAMES = { notification: 'Notification', post: 'Post', test: 'Test' }

function Switch({ label, checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" className="ch-switch" aria-label={label} aria-checked={checked}
      disabled={disabled} onClick={() => onChange(!checked)} />
  )
}

function Notice({ notice }) {
  if (!notice) return null
  return <div className={`ch-notice ch-notice--${notice.tone}`} role="status">{notice.text}</div>
}

/* ── what a channel receives ───────────────────────────────────────────── */

/** Which apps' notifications are copied, and whether their text goes along. */
function NotificationOptions({ apps, social, appIds, includeBody, onChange }) {
  // "Choose apps" with only Social ticked saves the same list as "Only Social",
  // so remember the owner's pick; otherwise that first tap changes nothing.
  const [choosing, setChoosing] = useState(false)
  const onlySocial = social && appIds?.length === 1 && appIds[0] === social.id
  const scope = appIds == null ? 'all' : onlySocial && !choosing ? 'social' : 'apps'
  const chosen = new Set(appIds || [])
  const options = [
    ...(social ? [{ value: 'social', label: 'Only Social' }] : []),
    { value: 'apps', label: 'Choose apps' },
    { value: 'all', label: 'Everything' },
  ]
  const pick = (next) => {
    setChoosing(next === 'apps')
    if (next === 'all') onChange({ appIds: null })
    else if (next === 'social') onChange({ appIds: [social.id] })
    else onChange({ appIds: [...chosen] })
  }
  const toggle = (id) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ appIds: [...next] })
  }
  return (
    <>
      <div className="ch-seg" role="radiogroup" aria-label="Which notifications">
        {options.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={scope === option.value}
            onClick={() => pick(option.value)}>{option.label}</button>
        ))}
      </div>
      {scope === 'apps' && (
        <div className="ch-chips">
          {apps.map((app) => (
            <button key={app.id} type="button" className="ch-chip" aria-pressed={chosen.has(app.id)}
              onClick={() => toggle(app.id)}>{app.name}</button>
          ))}
        </div>
      )}
      <div className="ch-switch-row">
        <span>
          <span className="ch-switch-title">Include message text</span>
          <span className="ch-hint">
            {includeBody
              ? 'The text is also kept by the service you send to.'
              : 'Off: only the title, like “Message from @name”, and a link back.'}
          </span>
        </span>
        <Switch label="Include message text" checked={includeBody} onChange={(next) => onChange({ includeBody: next })} />
      </div>
    </>
  )
}

/** Both feeds: notification copies and posts. */
function Feeds({ apps, social, value, onChange }) {
  return (
    <>
      <div className="ch-feed">
        <div className="ch-switch-row">
          <span>
            <span className="ch-switch-title">Copy notifications</span>
            <span className="ch-hint">Sent exactly when your phone would get them, so nothing goes out while you’re looking at that app.</span>
          </span>
          <Switch label="Copy notifications" checked={value.copyNotifications}
            onChange={(next) => onChange({ copyNotifications: next })} />
        </div>
        {value.copyNotifications && (
          <NotificationOptions apps={apps} social={social} appIds={value.appIds} includeBody={value.includeBody}
            onChange={onChange} />
        )}
      </div>
      <div className="ch-feed">
        <div className="ch-switch-row">
          <span>
            <span className="ch-switch-title">Allow posts</span>
            <span className="ch-hint">Your agents can post here when you ask, such as release notes or a weekly summary. Nobody can be @mentioned.</span>
          </span>
          <Switch label="Allow posts" checked={value.acceptPosts} onChange={(next) => onChange({ acceptPosts: next })} />
        </div>
      </div>
    </>
  )
}

function feedTags(channel, appNames) {
  const tags = []
  if (channel.copyNotifications) {
    tags.push(`${scopeText(channel.appIds, appNames)} · ${channel.includeBody ? 'with text' : 'titles only'}`)
  }
  if (channel.acceptPosts) tags.push('Posts')
  return tags
}

/* ── link entry, shared by add and replace ─────────────────────────────── */

/** A link being typed. `emptyKind` shapes the placeholder; a pasted link no
 * service claims counts as `otherKind` (the chosen tile when adding; a
 * generic webhook when replacing, as the server decides). */
function useLink(emptyKind, otherKind = emptyKind) {
  const [value, setValue] = useState('')
  const url = value.trim()
  const kind = detectKind(url) || (url ? otherKind : emptyKind)
  const service = SERVICE[kind]
  const complete = Boolean(url) && service.complete.test(url)
  return { value, setValue, url, kind, service, complete }
}

function LinkField({ id, link, emptyText }) {
  const state = link.url ? (link.complete ? 'ok' : 'bad') : ''
  return (
    <>
      <input id={id} className={`ch-input${state ? ` ch-input--${state}` : ''}`} type="url" inputMode="url"
        enterKeyHint="done" autoComplete="off" spellCheck={false} placeholder={link.service.placeholder}
        value={link.value} onChange={(event) => link.setValue(event.target.value)} aria-describedby={`${id}-check`} />
      <p id={`${id}-check`} className={`ch-check${state ? ` ch-check--${state}` : ''}`} role="status">
        {link.url ? (link.complete ? 'Looks like a complete link.' : link.service.incomplete) : emptyText}
      </p>
    </>
  )
}

/* ── guided add ────────────────────────────────────────────────────────── */

function GuidedAdd({ apps, social, token, onDone, onCancel }) {
  const [kind, setKind] = useState('slack')
  const link = useLink(kind)
  const [label, setLabel] = useState('')
  // Social is why notification copies exist, so it is the first choice when installed.
  const [feeds, setFeeds] = useState(null)
  const value = feeds || {
    copyNotifications: true, appIds: social ? [social.id] : null, includeBody: false, acceptPosts: false,
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const service = SERVICE[link.url ? link.kind : kind]
  const step = !link.url || !link.complete ? 2 : 3

  const submit = async (event) => {
    event.preventDefault()
    if (!link.complete || busy) return
    setBusy(true)
    setError('')
    try {
      const channel = await addChannel(token, {
        url: link.url, kind: link.kind, label: label.trim() || null,
        copy_notifications: value.copyNotifications, app_ids: value.appIds,
        include_body: value.includeBody, accept_posts: value.acceptPosts,
      })
      onDone(channel)
    } catch (err) {
      setError(err.message || 'That link could not be added.')
      setBusy(false)
    }
  }

  return (
    <form className="ch-card" onSubmit={submit} aria-labelledby="ch-add-title">
      <div className="ch-progress" aria-hidden="true">
        {[1, 2, 3].map((n) => <span key={n} className={n <= step ? 'on' : ''} />)}
      </div>
      <h2 className="ch-card-title" id="ch-add-title">Add a channel</h2>

      <p className="ch-step">1 · Where should Möbius post?</p>
      <div className="ch-tiles" role="radiogroup" aria-label="Service">
        {SERVICES.map((option) => (
          <button key={option.kind} type="button" role="radio" className="ch-tile"
            aria-checked={service.kind === option.kind}
            onClick={() => { setKind(option.kind); link.setValue('') }}>
            <ServiceIcon kind={option.kind} size={24} />
            {option.name}
          </button>
        ))}
      </div>
      <ol className="ch-guide">{service.steps.map((text, index) => <li key={index}>{text}</li>)}</ol>

      <label className="ch-step" htmlFor="ch-url">2 · Paste the link</label>
      <LinkField id="ch-url" link={link}
        emptyText="It works like a password: Möbius keeps it encrypted and never shows it again." />
      <input className="ch-input" type="text" maxLength={80} aria-label="Name (optional)" autoComplete="off"
        enterKeyHint="done" placeholder={`Name (optional), like ${service.kind === 'discord' ? '#alerts' : '#dev-team'}`}
        value={label} onChange={(event) => setLabel(event.target.value)} />

      <p className="ch-step">3 · What goes there</p>
      <Feeds apps={apps} social={social} value={value} onChange={(change) => setFeeds({ ...value, ...change })} />

      {error && <Notice notice={{ tone: 'bad', text: error }} />}
      <div className="ch-actions">
        <button className="ch-btn" type="submit" disabled={busy || !link.complete}>
          {busy ? 'Connecting…' : 'Connect and send test'}
        </button>
        {onCancel && <button className="ch-btn ch-btn--quiet" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

/* ── one channel, expanded ─────────────────────────────────────────────── */

function ReplaceLink({ channel, token, onDone, onCancel }) {
  const link = useLink(channel.kind, 'webhook')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = `ch-replace-${channel.id}`
  const submit = async (event) => {
    event.preventDefault()
    if (!link.complete || busy) return
    setBusy(true)
    setError('')
    try {
      await updateChannel(token, channel.id, { url: link.url })
      onDone()
    } catch (err) {
      setError(err.message || 'That link could not be saved.')
      setBusy(false)
    }
  }
  return (
    <form className="ch-feed" onSubmit={submit}>
      <label className="ch-switch-title" htmlFor={id}>New link</label>
      <LinkField id={id} link={link} emptyText="Everything else stays. The old link stops being used." />
      {error && <Notice notice={{ tone: 'bad', text: error }} />}
      <div className="ch-actions">
        <button className="ch-btn" type="submit" disabled={busy || !link.complete}>{busy ? 'Saving…' : 'Save and send test'}</button>
        <button className="ch-btn ch-btn--quiet" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function Activity({ token, channel }) {
  const [entries, setEntries] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    channelActivity(token, channel.id)
      .then((rows) => { if (live) setEntries(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [token, channel.id, channel.lastSentAt])
  return (
    <div>
      <span className="ch-switch-title">Recent</span>
      {failed ? <p className="ch-empty">Recent sends couldn’t be loaded.</p>
        : entries == null ? <p className="ch-empty">Loading…</p>
          : !entries.length ? <p className="ch-empty">Nothing sent yet.</p> : (
            <ul className="ch-activity">
              {entries.map((entry, index) => (
                <li key={index}>
                  <span className="ch-when">{ago(entry.sentAt)}</span>
                  <span className="ch-what">
                    <span className="ch-source">{SOURCE_NAMES[entry.source] || entry.source} · </span>
                    {entry.title}
                    {entry.error && <span className="ch-hint ch-bad">{entry.error}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}

function ChannelPanel({ channel, apps, social, token, appId, onChanged, setNotice }) {
  const [mode, setMode] = useState(null) // null | 'replace' | 'remove'
  const [busy, setBusy] = useState(null)

  const test = async () => {
    setBusy('test')
    setNotice(null)
    try {
      const result = await testChannel(token, channel.id, `/shell/?app=${appId}`)
      setNotice(result?.ok
        ? { tone: 'ok', text: `Sent a test message to ${channel.label}.` }
        : { tone: 'bad', text: `${channel.label}: ${result?.error || 'the test message was not sent.'}` })
    } catch (err) {
      setNotice({ tone: 'bad', text: `${channel.label}: ${err.message}` })
    }
    await onChanged()
    setBusy(null)
  }

  const change = async (next) => {
    const payload = {}
    if ('copyNotifications' in next) payload.copy_notifications = next.copyNotifications
    if ('appIds' in next) {
      if (next.appIds == null) payload.all_notifications = true
      else payload.app_ids = next.appIds
    }
    if ('includeBody' in next) payload.include_body = next.includeBody
    if ('acceptPosts' in next) payload.accept_posts = next.acceptPosts
    onChanged({ ...channel, ...next })
    try {
      await updateChannel(token, channel.id, payload)
    } catch {
      setNotice({ tone: 'bad', text: `Couldn’t change ${channel.label}. Try again.` })
    }
    await onChanged()
  }

  const remove = async () => {
    setBusy('remove')
    setNotice(null)
    try {
      await removeChannel(token, channel.id)
      setNotice({ tone: 'ok', text: `Removed ${channel.label}. Nothing goes there any more.` })
    } catch (err) {
      setNotice({ tone: 'bad', text: `Couldn’t remove ${channel.label}: ${err.message}` })
    }
    await onChanged()
    setBusy(null)
  }

  const broken = Boolean(channel.lastError)
  return (
    <div className="ch-panel">
      {broken && (
        <p className="ch-hint">If the link was deleted in {SERVICE[channel.kind]?.name || 'the service'}, replace it with a new one.</p>
      )}
      <Feeds apps={apps} social={social} value={channel} onChange={change} />
      <Activity token={token} channel={channel} />
      <span className="ch-hint">Link {channel.urlHint}</span>
      {mode === 'replace' ? (
        <ReplaceLink channel={channel} token={token} onCancel={() => setMode(null)}
          onDone={async () => { setMode(null); await test() }} />
      ) : mode === 'remove' ? (
        <div className="ch-confirm" role="group" aria-label={`Remove ${channel.label}`}>
          <p>Remove {channel.label}? Notifications and posts stop going there. You can add the link again later.</p>
          <div className="ch-actions">
            <button className="ch-btn ch-btn--danger-fill" type="button" disabled={!!busy} onClick={remove}>
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </button>
            <button className="ch-btn ch-btn--quiet" type="button" disabled={!!busy} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="ch-actions">
          <button className="ch-btn ch-btn--quiet" type="button" disabled={!!busy} onClick={test}>
            {busy === 'test' ? 'Sending…' : 'Send test'}
          </button>
          <button className="ch-btn ch-btn--quiet" type="button" disabled={!!busy}
            onClick={() => { setMode('replace'); setNotice(null) }}>Replace link</button>
          <button className="ch-btn ch-btn--danger" type="button" disabled={!!busy}
            onClick={() => { setMode('remove'); setNotice(null) }}>Remove</button>
        </div>
      )}
    </div>
  )
}

function ChannelRow({ channel, appNames, expanded, onToggle }) {
  const state = health(channel)
  const tags = feedTags(channel, appNames)
  return (
    <button type="button" className="ch-row" aria-expanded={expanded} onClick={onToggle}>
      <span className="ch-mark" aria-hidden="true"><ServiceIcon kind={channel.kind} /></span>
      <span className="ch-row-body">
        <span className="ch-row-title">{channel.label}</span>
        <span className={`ch-row-sub${state.tone === 'bad' ? ' ch-bad' : ''}`}>
          <span className={`ch-dot ch-dot--${state.tone}`} aria-hidden="true" />{state.text}
        </span>
        <span className="ch-feeds">
          {tags.length ? tags.map((tag) => <span key={tag} className="ch-tag">{tag}</span>)
            : <span className="ch-tag ch-tag--off">Paused: nothing goes here</span>}
        </span>
      </span>
      {state.tone === 'bad' && <span className="ch-badge">Fix</span>}
      <span className={`ch-chevron${expanded ? ' ch-chevron--open' : ''}`} aria-hidden="true">›</span>
    </button>
  )
}

/* ── the app ───────────────────────────────────────────────────────────── */

export default function App({ appId, token }) {
  const [channels, setChannels] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [apps, setApps] = useState([])
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      const rows = await listChannels(token)
      setChannels(Array.isArray(rows) ? rows : [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message || 'Channels couldn’t be loaded.')
    }
  }, [token])

  useEffect(() => {
    load()
    listApps(token).then(setApps).catch(() => setApps([]))
    // Agents change channels from chat too; refresh whenever the app is shown.
    const off = window.mobius?.onVisibilityChange?.((visible) => { if (visible) load() })
    return () => { if (typeof off === 'function') off() }
  }, [token, load])

  const social = apps.find((app) => app.slug === 'social') || null
  const appNames = useMemo(() => new Map(apps.map((app) => [app.id, app.name])), [apps])
  const list = channels || []
  const showAdd = adding || (channels != null && list.length === 0)

  // With a row, apply an optimistic change; without, reload from the server.
  const changed = useCallback(async (row) => {
    if (row) setChannels((rows) => (rows || []).map((each) => (each.id === row.id ? row : each)))
    else await load()
  }, [load])

  const added = async (channel) => {
    setAdding(false)
    setOpen(channel.id)
    await load()
    try {
      const result = await testChannel(token, channel.id, `/shell/?app=${appId}`)
      setNotice(result?.ok
        ? { tone: 'ok', text: `${channel.label} is connected. Möbius sent it a test message.` }
        : { tone: 'bad', text: `${channel.label} was added, but the test didn’t arrive: ${result?.error || 'unknown error'}` })
    } catch (err) {
      setNotice({ tone: 'bad', text: `${channel.label} was added, but the test failed: ${err.message}` })
    }
    await load()
  }

  return (
    <div className="ch-root">
      <style>{CSS}</style>
      <header className="ch-header">
        <div className="ch-header-inner">
          <div className="ch-brand">
            <img src={`/api/apps/${appId}/icon?size=64`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
            <div>
              <h1 className="ch-title">Channels</h1>
              <p className="ch-subtitle">Where Möbius posts outside: Slack, Discord, ntfy and webhooks</p>
            </div>
          </div>
          {list.length > 0 && !showAdd && (
            <button className="ch-btn" type="button" onClick={() => { setAdding(true); setNotice(null) }}>
              <Plus width={16} height={16} aria-hidden="true" />Add
            </button>
          )}
        </div>
      </header>
      <div className="ch-scroll">
        <div className="ch-inner">
          {loadError && <Notice notice={{ tone: 'bad', text: loadError }} />}
          {channels == null && !loadError && <div className="ch-loading">Loading channels…</div>}
          {list.length > 0 && (
            <>
              <p className="ch-lede">
                Each channel can get a copy of your notifications, posts your agents send when you ask (like release notes), or both.
              </p>
              <div className="ch-list">
                {list.map((channel) => (
                  <div key={channel.id} className="ch-item">
                    <ChannelRow channel={channel} appNames={appNames} expanded={open === channel.id}
                      onToggle={() => setOpen(open === channel.id ? null : channel.id)} />
                    {open === channel.id && (
                      <ChannelPanel channel={channel} apps={apps} social={social} token={token} appId={appId}
                        onChanged={changed} setNotice={setNotice} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <Notice notice={notice} />
          {showAdd && (
            <GuidedAdd apps={apps} social={social} token={token} onDone={added}
              onCancel={list.length ? () => setAdding(false) : null} />
          )}
        </div>
      </div>
    </div>
  )
}
