/**
 * firebase-tools 15 routes even emulator-to-emulator reads through ProxyAgent,
 * ignoring NO_PROXY. A rejected loopback request is treated as a missing
 * Firestore document, which can silently bypass Storage counter guards.
 * Keep external traffic on the same proxy; only local emulator hosts are direct.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cliRequire = createRequire(
  require.resolve('firebase-tools/lib/bin/firebase.js'),
)
const undici = cliRequire('undici')

undici.ProxyAgent = class LoopbackAwareProxyAgent extends (
  undici.EnvHttpProxyAgent
) {
  constructor({ uri }) {
    super({
      httpProxy: uri,
      httpsProxy: uri,
      noProxy: 'localhost,127.0.0.1,::1,[::1]',
    })
  }
}
