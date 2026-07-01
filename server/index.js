import cors from 'cors'
import express from 'express'
import reportingRoutes from './reporting/routes.js'
import posPrintRoutes from './posPrint/routes.js'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use('/api', reportingRoutes)
app.use('/api', posPrintRoutes)

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aura-stay-reporting-api', time: new Date().toISOString() })
})

app.listen(port, () => {
  console.log(`Aura Stay reporting API listening on :${port}`)
})
