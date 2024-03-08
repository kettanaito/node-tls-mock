import { it, expect } from 'vitest'
import https from 'node:https'
import './index.js'

it('', async () => {
  const request = https.request('https://example.com')
  request.write(Buffer.from('hello'))
  request.end()

  request.on('socket', (socket) => {
    socket.on('connect', () => {
      console.log('!!! [test] socket connect')
    })

    socket.passthrough()
    // socket.respondWith(new Response('hello world'))
  })

  request.on('response', (response) => {
    const buffer = []
    response.on('data', (c) => buffer.push(c))
    response.on('end', () =>
      console.log(
        'response:',
        response.statusCode,
        response.statusMessage,
        Buffer.concat(buffer).toString('utf8'),
      ),
    )
  })

  await new Promise((ok, fail) => {
    request.on('error', fail)
    request.on('response', ok)
  })
})
