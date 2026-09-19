import { Request, Response, NextFunction } from 'express'
import { LogPulseClient } from '../client.js'

export function expressMiddleware(client: LogPulseClient) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()

    res.on('finish', () => {
      const latency = Date.now() - start
      const fields: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        latency: `${latency}ms`,
        client_ip: req.ip || req.socket.remoteAddress,
      }

      if (res.statusCode >= 500) {
        client.error('request failed', fields)
      } else if (res.statusCode >= 400) {
        client.warn('request failed', fields)
      } else {
        client.info('request', fields)
      }
    })

    next()
  }
}
