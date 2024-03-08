import { it, expect } from 'vitest'
import http from 'node:http'
import https from 'node:https'
import './index.js'
import './spy.js'

it('performs the HTTP request', async () => {
  const request = http.request('http://example.com')
  request.write(Buffer.from('hello'))
  request.end()

  request.on('socket', (socket) => {
    socket
      .on('connect', () => {
        console.log('!!! [test] socket connect')
      })
      .on('secureConnect', () => console.log('!!! [test] socket secureConnect'))
      .on('error', (error) => console.error('[test] socket error', error))
      .on('drain', () => {
        console.log('DRAINED')
      })

    socket.on('request', () => {
      socket.passthrough()
      // socket.respondWith(new Response('hello world'))
    })
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

it.only('performs the HTTPS request', async () => {
  const request = https.request('https://example.com')
  request.write(Buffer.from('hello'))
  request.end()

  request.on('socket', (socket) => {
    socket
      .on('connect', () => {
        console.log('!!! [test] socket connect')
      })
      .on('secureConnect', () => console.log('!!! [test] socket secureConnect'))
      .on('error', (error) => console.error('[test] socket error', error))
      .on('drain', () => {
        console.log('DRAINED')
      })

    socket.on('request', () => {
      socket.passthrough()
      // socket.respondWith(new Response('hello world'))
    })
  })

  request.on('response', (response) => {
    const buffer = []
    response.on('data', (c) => buffer.push(c))
    response.on('end', () => {
      // console.log(
      //   'response:',
      //   response.statusCode,
      //   response.statusMessage,
      //   Buffer.concat(buffer).toString('utf8'),
      // )
    })
  })

  await new Promise((ok, fail) => {
    request.on('error', fail)
    request.on('response', ok)
  })
})
