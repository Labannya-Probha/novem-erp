import express from 'express'
import { generateReport, getReport, listReports } from './reportService.js'
import { toCsv, toExcel, toPdfHtml } from './exporters.js'

const router = express.Router()

const currentUser = (req) => ({
  id: req.header('x-user-id'),
  name: req.header('x-user-name') || 'API User',
  role: req.header('x-user-role') || 'SUPERUSER',
  reportCodes: req.header('x-report-codes')?.split(',').map((x) => x.trim()).filter(Boolean),
})

const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next)
  } catch (error) {
    next(error)
  }
}

router.get('/reports', (req, res) => {
  res.json(listReports(currentUser(req)))
})

router.get('/reports/:reportCode', (req, res) => {
  res.json(getReport(req.params.reportCode, currentUser(req)))
})

router.post('/reports/:reportCode/generate', (req, res) => {
  res.json(generateReport(req.params.reportCode, req.body, currentUser(req)))
})

router.post('/reports/:reportCode/export/csv', (req, res) => {
  const payload = generateReport(req.params.reportCode, req.body, currentUser(req))
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${payload.report.code}.csv"`)
  res.send(toCsv(payload))
})

router.post('/reports/:reportCode/export/excel', asyncRoute(async (req, res) => {
  const payload = generateReport(req.params.reportCode, req.body, currentUser(req))
  const buffer = await toExcel(payload)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${payload.report.code}.xlsx"`)
  res.send(Buffer.from(buffer))
}))

router.post('/reports/:reportCode/export/pdf', (req, res) => {
  const payload = generateReport(req.params.reportCode, req.body, currentUser(req))
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Disposition', `inline; filename="${payload.report.code}.html"`)
  res.send(toPdfHtml(payload))
})

router.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    error: error.message || 'Report service failed',
    code: error.status || 500,
  })
})

export default router
