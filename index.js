import tls from 'node:tls'
import net from 'node:net'
import { STATUS_CODES } from 'node:http'

const originalTlsConnect = tls.connect
tls.connect = function mockTlsConnect(...args) {
  const [options, callback] = net._normalizeArgs(args)
  return new MockTlsSocket(options, callback)
}

const OriginalSocket = net.Socket
const originalSocketConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function mockSocketConnect(...args) {
  const [options, callback] = net._normalizeArgs(args)
  return new MockSocket(options, callback)
}

class MockSocket extends net.Socket {
  constructor(options, callback) {
    super()
    this.options = options
    this.callback = callback
    this.error = null
    this.requestBuffer = []

    this.connect()
  }

  connect() {
    console.trace('MockSocket.connect()')
    this.connecting = true
  }

  write(chunk, encoding, callback) {
    // console.log('write:', chunk, encoding)
    this.requestBuffer.push([chunk, encoding, callback])

    // TODO: This will be signalled by the HTTP parser.
    if (chunk === '') {
      this.emit('request')
    }

    return false
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
    console.log('MockSocket.passthrough()')

    // Establish the actual Socket connection.
    // Applying it to this class will automatically
    // forward all the writes/pushes/events.
    const socket = originalSocketConnect.apply(this, [
      this.options,
      this.callback,
    ])

    console.log('writing chunks', this.requestBuffer)
    for (const [chunk, encoding, callback] of this.requestBuffer) {
      socket.write(chunk, encoding, callback)
    }

    console.log('request written!')
  }

  /**
   * Push this `Response` instance as an incoming response
   * to this socket.
   */
  async respondWith(response) {
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

class MockTlsSocket extends tls.TLSSocket {
  constructor(options, callback) {
    const socket = new MockSocket(options, callback)
    super(socket)
    this.options = options
    this.callback = callback
    this.socket = socket

    this.socket.on('connect', () => {
      this.emit('secureConnect')
    })

    // TODO: Remove this, really.
    this.socket.on('request', () => {
      this.emit('request')
    })
  }

  write(chunk, encoding, callback) {
    this.socket.write(chunk, encoding, callback)
  }

  push(chunk) {
    this.socket.push(chunk)
  }

  passthrough() {
    console.log('TLS passthrough')
    // this.socket.passthrough()

    const tlsSocket = new tls.TLSSocket(new OriginalSocket(), this.options)
    if (this.callback) {
      tlsSocket.once('secureConnect', this.callback)
    }

    // originalTlsConnect.apply(this, [this.options, this.callback])

    this.socket.on('data', (chunk) => this.emit('data', chunk))
    this.socket.on('error', (error) => {
      console.trace(error)

      this.emit('error', error)
    })
    this.socket.on('end', () => this.emit('end'))
  }
}
