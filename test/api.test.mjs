// Run: node --test test/*.test.mjs
// Changes to one channel must reach the server in the order they were made,
// however the network orders the replies.
import assert from 'node:assert/strict'
import test from 'node:test'
import { changesPending, updateChannel } from '../api.js'

// A fetch whose replies the test releases by hand, in any order.
function heldFetch() {
  const sent = []
  globalThis.fetch = (path, init) => new Promise((resolve, reject) => {
    sent.push({
      path, method: init.method, body: init.body && JSON.parse(init.body),
      reply: (status = 200) => resolve(new Response(JSON.stringify({}), { status })),
      fail: () => reject(new TypeError('network down')),
    })
  })
  return sent
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('a second change waits until the first has been answered', async () => {
  const sent = heldFetch()
  const first = updateChannel('t', 'ch1', { include_body: true })
  const second = updateChannel('t', 'ch1', { include_body: false })
  await tick()
  // The reversed-reply race needs both on the wire at once; only the first is.
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].body, { include_body: true })
  assert.equal(changesPending('ch1'), true)
  sent[0].reply()
  await first
  await tick()
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1].body, { include_body: false })
  assert.equal(changesPending('ch1'), true)
  sent[1].reply()
  await second
  assert.equal(changesPending('ch1'), false)
})

test('a failed change does not hold up the next one', async () => {
  const sent = heldFetch()
  const first = updateChannel('t', 'ch2', { accept_posts: true })
  const second = updateChannel('t', 'ch2', { accept_posts: false })
  await tick()
  sent[0].fail()
  await assert.rejects(first, /network down/)
  await tick()
  assert.equal(sent.length, 2)
  sent[1].reply()
  await second
  assert.equal(changesPending('ch2'), false)
})

test('a refused change still rejects with the server’s reason', async () => {
  const sent = heldFetch()
  const write = updateChannel('t', 'ch3', { include_body: true })
  await tick()
  sent[0].reply(400)
  await assert.rejects(write, (error) => error.status === 400)
  assert.equal(changesPending('ch3'), false)
})

test('different channels do not wait for each other', async () => {
  const sent = heldFetch()
  const a = updateChannel('t', 'a', { include_body: true })
  const b = updateChannel('t', 'b', { include_body: true })
  await tick()
  assert.deepEqual(sent.map((each) => each.path), ['/api/channels/a', '/api/channels/b'])
  sent[1].reply()
  sent[0].reply()
  await Promise.all([a, b])
})
