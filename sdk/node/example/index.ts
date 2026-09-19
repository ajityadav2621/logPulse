import express from 'express'
import { LogPulseClient, initGlobal, expressMiddleware } from '../src'

const client = new LogPulseClient('my-app-api-key', 'payments-api', {
  baseURL: 'http://localhost:8080',
  bufferSize: 100,
  flushInterval: 5000,
})

const app = express()

app.use(express.json())
app.use(expressMiddleware(client))

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/charge', (req, res) => {
  client.info('charge initiated', { order_id: req.body.order_id })
  res.json({ status: 'charged' })
})

app.listen(3000, () => {
  console.log('Server running on :3000')
})

process.on('SIGINT', async () => {
  await client.close()
  process.exit(0)
})
