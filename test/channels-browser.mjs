// Run: MOBIUS_FRONTEND_NODE_MODULES=/data/platform/frontend/node_modules \
//      node test/channels-browser.mjs [--screenshots DIR]
// The real app in headless Chromium against a fake server inside the page:
// nothing leaves the browser (every request is answered by a stub, and CSP and
// network blocking stand behind it). Covers what only a mounted channel shows:
// changes whose replies come back in reverse order, and Recent recovering from
// a failed load without the channel being reopened. Rolldown and React come
// from the Möbius shell's installed frontend, as when Möbius builds the app.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOST_FRONTEND_MODULES = '/data/platform/frontend/node_modules'
const frontendModules = process.env.MOBIUS_FRONTEND_NODE_MODULES
  || (existsSync(HOST_FRONTEND_MODULES) ? HOST_FRONTEND_MODULES : '')
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const shotsFlag = process.argv.indexOf('--screenshots')
const shotsDir = shotsFlag > 0 ? resolve(process.argv[shotsFlag + 1]) : ''
const ENTRY = '\0channels-browser-fixture'

const fixture = String.raw`
import { createRoot } from 'react-dom/client'
import App from './index.jsx'

// The fake server. A change is applied when the test releases its reply, the
// way the platform applies each change when it reaches it.
const server = {
  channel: { id: 'c1', kind: 'slack', label: '#team-alerts', urlHint: '…/T0/B0/xx', lastSentAt: null, lastError: null,
    copyNotifications: true, appIds: [1], includeBody: false, acceptPosts: false },
  activityFails: true, activity: [], held: [], applied: [],
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function apply(body) {
  const c = server.channel
  if ('copy_notifications' in body) c.copyNotifications = body.copy_notifications
  if (body.all_notifications) c.appIds = null
  if ('app_ids' in body) c.appIds = body.app_ids
  if ('include_body' in body) c.includeBody = body.include_body
  if ('accept_posts' in body) c.acceptPosts = body.accept_posts
  server.applied.push(body)
}
window.fetch = async (path, init = {}) => {
  const method = init.method || 'GET'
  const body = init.body ? JSON.parse(init.body) : null
  if (method === 'GET' && path === '/api/channels') return json([{ ...server.channel }])
  if (method === 'GET' && path === '/api/apps/') return json([{ id: 1, name: 'Social', slug: 'social' }, { id: 2, name: 'Tasks', slug: 'tasks' }])
  if (method === 'GET' && path === '/api/channels/c1/activity') {
    if (server.activityFails) throw new TypeError('Failed to fetch')
    return json(server.activity)
  }
  if (method === 'PATCH' && path === '/api/channels/c1') {
    return new Promise((resolve) => server.held.push({ body, release: () => { apply(body); resolve(json({ ...server.channel })) } }))
  }
  if (method === 'POST' && path === '/api/channels/c1/test') {
    server.channel.lastSentAt = new Date().toISOString()
    server.activity.unshift({ sentAt: server.channel.lastSentAt, source: 'test', title: 'Test message from Möbius' })
    return json({ ok: true })
  }
  throw new Error('unexpected request ' + method + ' ' + path)
}

createRoot(document.getElementById('root')).render(<App appId={7} token="test-token" />)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const text = () => document.body.innerText
async function until(test, ms = 3000) {
  const end = Date.now() + ms
  while (!test()) { if (Date.now() > end) return false; await sleep(10) }
  return true
}
const button = (name) => [...document.querySelectorAll('button')].find((each) => each.textContent.trim() === name)
const toggle = (label) => document.querySelector('[role="switch"][aria-label="' + label + '"]')

window.runChecks = async () => {
  const checks = []
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail })
  try {
    if (!await until(() => document.querySelector('.ch-row'))) throw new Error('the channel list never loaded')
    document.querySelector('.ch-row').click()

    // Recent fails to load, then a test message is sent and the reload works.
    check('Recent shows the failed load', await until(() => text().includes('Recent sends couldn’t be loaded.')))
    server.activityFails = false
    button('Send test').click()
    const recovered = await until(() => text().includes('Test message from Möbius') && !text().includes('couldn’t be loaded'))
    check('Recent recovers without reopening the channel', recovered,
      text().includes('couldn’t be loaded') ? 'still says the sends couldn’t be loaded' : '')

    // Include message text on, then off; every reply is released newest first.
    if (!await until(() => toggle('Include message text'))) throw new Error('the channel never opened')
    toggle('Include message text').click()
    await sleep(20)
    toggle('Include message text').click()
    await sleep(20)
    let quiet = 0
    while (quiet < 15) {
      const next = server.held.pop()
      if (next) { quiet = 0; next.release() } else quiet += 1
      await sleep(20)
    }
    await sleep(100)
    const order = server.applied.map((each) => each.include_body)
    check('changes reach the server in the order they were made', order.join() === 'true,false', 'applied ' + order.join(', '))
    check('the saved setting is the last choice (off)', server.channel.includeBody === false)
    check('the switch shows the last choice (off)', toggle('Include message text').getAttribute('aria-checked') === 'false')
  } catch (error) {
    check('fixture ran', false, error.stack)
  }
  document.querySelector('.ch-switch-title')?.closest('.ch-panel')?.scrollIntoView({ block: 'start' })
  return checks
}
`

async function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  for (const path of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (existsSync(path)) return path
  }
  const directory = '/opt/agent-browser/browsers'
  if (existsSync(directory)) {
    for (const name of (await readdir(directory)).sort().reverse()) {
      const path = join(directory, name, 'chrome')
      if (existsSync(path)) return path
    }
  }
  throw new Error('No installed Chromium found; set CHROMIUM_PATH. This test never installs a browser.')
}

// Chrome DevTools over --remote-debugging-pipe: NUL-separated JSON on fds 3 and 4.
function devtools(browser) {
  let serial = 0
  let buffer = ''
  const pending = new Map()
  browser.stdio[4].on('data', (chunk) => {
    buffer += chunk.toString()
    let end
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      const waiter = message.id && pending.get(message.id)
      if (!waiter) continue
      pending.delete(message.id)
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
      else waiter.resolve(message.result)
    }
  })
  return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++serial
    pending.set(id, { resolve, reject })
    browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0')
  })
}

async function bundle() {
  const require = createRequire(join(frontendModules, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  const build = await rolldown({
    input: ENTRY,
    platform: 'browser',
    tsconfig: false,
    transform: { jsx: 'react-jsx', define: { 'process.env.NODE_ENV': JSON.stringify('production') } },
    resolve: { modules: [frontendModules, 'node_modules'] },
    plugins: [{
      name: 'channels-browser-fixture',
      resolveId(id, importer) {
        if (id === ENTRY) return id
        if (importer === ENTRY && id.startsWith('.')) return join(root, id)
        return null
      },
      load(id) { return id === ENTRY ? { code: fixture, moduleType: 'jsx' } : null },
    }],
  })
  const { output } = await build.generate({ format: 'iife' })
  await build.close()
  return output[0].code
}

// The shell's dark theme tokens, with a concrete proportional font for captures.
const THEME = ':root{color-scheme:dark;--bg:#0d0d0d;--surface:#171717;--surface-2:#212121;--border:#2a2a2a;'
  + '--text:#ececec;--muted:#a8a8a8;--accent:#8b6cf7;--accent-fill:#8b6cf7;--accent-fill-hover:#7c5ce6;--accent-fg:#fff;'
  + '--accent-text:#b9a6ff;--danger:#f87171;--danger-fill:#dc2626;--danger-text:#fca5a5;--green:#10b981;--green-text:#6ee7b7;'
  + "--font:'Liberation Sans',Arial,sans-serif}html,body,#root{height:100%;margin:0;background:var(--bg)}"

async function main() {
  if (!frontendModules) throw new Error('Set MOBIUS_FRONTEND_NODE_MODULES to the Möbius shell’s frontend/node_modules.')
  const code = await bundle()
  const temporary = await mkdtemp(join(tmpdir(), 'channels-browser-'))
  let browser
  let failed = 0
  try {
    const page = join(temporary, 'fixture.html')
    await writeFile(page, '<!doctype html><html><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'">'
      + `<style>${THEME}</style></head><body><div id="root"></div><script>`
      + code.replace(/<\/script/gi, '<\\/script') + '</script></body></html>')
    browser = spawn(await chromiumPath(), ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
      '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND',
      '--remote-debugging-pipe', `--user-data-dir=${join(temporary, 'profile')}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] })
    browser.stderr.resume()
    const send = devtools(browser)
    if (shotsDir) await mkdir(shotsDir, { recursive: true })
    for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
      await send('Network.enable', {}, sessionId)
      await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] }, sessionId)
      await send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'phone',
      }, sessionId)
      await send('Page.enable', {}, sessionId)
      await send('Page.navigate', { url: pathToFileURL(page).href }, sessionId)
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression: `new Promise((resolve, reject) => {
          const deadline = Date.now() + 5000
          ;(function ready() {
            if (window.runChecks) window.runChecks().then(resolve, reject)
            else if (Date.now() > deadline) reject(new Error('the fixture did not load'))
            else setTimeout(ready, 20)
          })()
        })`,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId)
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text)
      for (const each of result.value) {
        if (!each.ok) failed += 1
        console.log(`${each.ok ? 'ok    ' : 'FAILED'} ${viewport.name}: ${each.name}${each.detail ? ` (${each.detail})` : ''}`)
      }
      if (shotsDir) {
        const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
        await writeFile(join(shotsDir, `${viewport.name}.png`), Buffer.from(data, 'base64'))
      }
      await send('Target.closeTarget', { targetId })
    }
  } finally {
    if (browser && browser.exitCode == null) {
      const exited = new Promise((done) => browser.once('exit', done))
      browser.kill()
      await exited
    }
    await rm(temporary, { recursive: true, force: true, maxRetries: 3 })
  }
  console.log(failed ? `${failed} check(s) failed` : 'all checks passed')
  process.exit(failed ? 1 : 0)
}

main().catch((error) => { console.error(error); process.exit(2) })
