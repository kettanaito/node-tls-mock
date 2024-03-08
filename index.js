import tls from 'node:tls'
import net from 'node:net'
import { STATUS_CODES } from 'node:http'
import { DeferredPromise } from '@open-draft/deferred-promise'

tls.connect = function (...args) {
  const [options, callback] = net._normalizeArgs(args)
  return new MockSocket(options, callback)
}

class MockSocket extends net.Socket {
  constructor(options, callback) {
    super()
    this.options = options
    this.callback = callback
    this.socket = null
    this.connectionPromise = new DeferredPromise()
    this.error = null
    this.requestBuffer = []

    this.connect()
  }

  connect() {
    this.connecting = true

    // Try establishing an actual connecting to this address.
    this.socket = new net.Socket()
    this.socket.connect(this.options)

    this.socket
      .once('connect', () => {
        this.socket.pause()

        this.connecting = false
        this.emit('connect')
        this.connectionPromise.resolve()
      })
      .once('secureConnect', () => this.emit('secureConnect'))
      .once('ready', () => this.emit('ready'))
      .once('error', () => {
        this.connectionPromise.reject()
      })
  }

  write(chunk, encoding, callback) {
    console.log('write:', chunk, encoding)
    this.requestBuffer.push([chunk, encoding, callback])
    return true
  }

  push(chunk, encoding) {
    console.log('push:', chunk)

    if (chunk !== null) {
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk, encoding)
      this.emit('data', buffer)
    } else {
      this.emit('end')
    }

    return true
  }

  async passthrough() {
    await this.connectionPromise

    console.log('passthrough')

    // Replay the connection error.
    if (this.error) {
      this._hadError = true
      this.destroy(this.error)
      return
    }

    console.log('writing chunks...', this.requestBuffer)
    for (const [chunk, encoding, callback] of this.requestBuffer) {
      this.socket.write(chunk, encoding, callback)
    }

    console.log('request written!', this.socket.destroyed)

    this.socket
      .on('data', (chunk) => this.emit('data', chunk))
      .on('drain', () => this.emit('drain'))
      .on('timeout', () => this.emit('timeout'))
      .on('error', (error) => {
        console.trace(error)

        this._hadError = true
        this.emit('error', error)
      })
      .on('close', (hadError) => this.emit('close', hadError))
      .on('end', () => this.emit('end'))

    this.socket.resume()
  }

  /**
   * Push this `Response` instance as an incoming response
   * to this socket.
   */
  async respondWith(response) {
    console.log(this.socket.connecting)

    await this.connectionPromise

    console.log(this.socket.connecting)

    // if (!socket) {
    //   this.connecting = false
    //   console.log('MockSocket emitting "connect"')
    //   this.emit('connect')
    //   this.emit('ready')
    // }

    this.emit('resume')

    const httpHeaders = []

    httpHeaders.push(
      Buffer.from(
        `HTTP/1.1 ${response.status} ${response.statusText || STATUS_CODES[response.status]}\r\n`,
      ),
    )

    for (const [name, value] of response.headers) {
      httpHeaders.push(Buffer.from(`${name}: ${value}\r\n`))
    }

    if (response.body) {
      httpHeaders.push(Buffer.from('\r\n'))
      const reader = response.body.getReader()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        if (httpHeaders.length > 0) {
          httpHeaders.push(Buffer.from(value))
          this.push(Buffer.concat(httpHeaders))
          httpHeaders.length = 0
          continue
        }

        this.push(value)
      }
    }

    this.push('\r\n')
    this.push(null)
  }
}
