// Same-origin helpers for the platform's outside channels (/api/channels).
// The app token reaches them through permissions.channels_manage. A channel's
// link is a credential: it is sent once when added or replaced and never
// comes back; responses carry only a short hint of it.

async function request(token, path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    let data = null
    try {
      data = res.status === 204 ? null : await res.json()
    } catch {
      /* empty or non-JSON body */
    }
    if (!res.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : ''
      const error = new Error(detail || 'Möbius could not do that. Try again.')
      error.status = res.status
      throw error
    }
    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Möbius took too long to answer. Try again.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const one = (id) => `/api/channels/${encodeURIComponent(id)}`

export const listChannels = (token) => request(token, '/api/channels')
export const addChannel = (token, payload) => request(token, '/api/channels', { method: 'POST', body: payload })
export const updateChannel = (token, id, payload) => request(token, one(id), { method: 'PATCH', body: payload })
export const removeChannel = (token, id) => request(token, one(id), { method: 'DELETE' })
export const channelActivity = (token, id) => request(token, `${one(id)}/activity`)
// The test links back to this app, so a tap in Slack lands on Channels.
export const testChannel = (token, id, link) => request(token, `${one(id)}/test`, { method: 'POST', body: { link } })

export async function listApps(token) {
  const apps = await request(token, '/api/apps/')
  return (Array.isArray(apps) ? apps : [])
    .filter((app) => app && app.id != null && app.name)
    .sort((a, b) => a.name.localeCompare(b.name))
}
