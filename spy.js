import tls from 'node:tls'
import net from 'node:net'

net.Socket.prototype.emit = new Proxy(net.Socket.prototype.emit, {
  apply(target, context, args) {
    console.log('Socket.emit', args)

    if (args[0] === 'session') {
      // console.log('SESSION', args[1].toString('utf8'))
    }

    return Reflect.apply(target, context, args)
  },
})

tls.TLSSocket.prototype.emit = new Proxy(tls.TLSSocket.prototype.emit, {
  apply(target, context, args) {
    console.log('TLSSocket.emit', args)
    return Reflect.apply(target, context, args)
  },
})
