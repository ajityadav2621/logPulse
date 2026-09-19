export {
  LogPulseClient,
  initGlobal,
  getGlobal,
  globalInfo,
  globalWarn,
  globalError,
} from './client.js'

export { expressMiddleware } from './middleware/express.js'

export type { LogLevel, LogEntry, ClientOptions } from './client.js'
