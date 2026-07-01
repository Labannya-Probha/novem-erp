import express from 'express'

const router = express.Router()

const currentUser = (req) => ({
  id: req.header('x-user-id') || null,
  name: req.header('x-user-name') || 'API User',
  role: req.header('x-user-role') || 'SUPERUSER',
  tenantId: req.header('x-tenant-id') || null,
})

const now = () => new Date().toISOString()

const hashDocument = (parts = []) => {
  const text = parts.filter(Boolean).join('|')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}

const profileCatalog = [
  'CUSTOMER_COPY',
  'MERCHANT_COPY',
  'RESORT_COPY',
  'KITCHEN_COPY',
  'BAR_COPY',
  'DELIVERY_COPY',
  'AUDIT_COPY',
  'REPRINT_COPY',
  'VOID_COPY',
  'DRAFT_COPY',
].map((code) => ({
  profile_code: code,
  profile_name: code.replaceAll('_', ' '),
  copy_title: code.replaceAll('_', ' '),
  paper_size: '80mm',
  template_code: code.includes('KITCHEN') ? 'THERMAL_KOT_V1' : code.includes('BAR') ? 'THERMAL_BOT_V1' : 'THERMAL_RECEIPT_V1',
}))

const responseEnvelope = (req, payload = {}) => ({
  ok: true,
  tenant_id: currentUser(req).tenantId,
  generated_by: currentUser(req).name,
  generated_at: now(),
  ...payload,
})

const printJob = (req, copyType, status = 'QUEUED') => {
  const order = req.body?.order || {}
  const documentHash = hashDocument([currentUser(req).tenantId, order.id, order.order_no, copyType, now()])
  return responseEnvelope(req, {
    job: {
      id: `job_${documentHash.toLowerCase()}`,
      status,
      copy_type: copyType,
      order_id: order.id || null,
      invoice_id: order.invoice_id || order.invoice_no || null,
      printer_device: req.body?.printer_device || 'BROWSER',
      document_hash: documentHash,
      requested_at: now(),
    },
  })
}

router.get('/pos/print/settings', (req, res) => {
  res.json(responseEnvelope(req, {
    settings: {
      receipt_template_code: 'THERMAL_RECEIPT_V1',
      kot_template_code: 'THERMAL_KOT_V1',
      bot_template_code: 'THERMAL_BOT_V1',
      print_width: '80mm',
      customer_copy_enabled: true,
      merchant_copy_enabled: true,
      resort_copy_enabled: true,
      kot_auto_print: true,
      bot_auto_print: true,
      show_logo: true,
      show_qr: true,
      loyalty_section_enabled: false,
    },
  }))
})

router.post('/pos/print/settings', (req, res) => {
  res.json(responseEnvelope(req, { settings: { ...req.body, updated_at: now() } }))
})

router.get('/pos/print/profiles', (req, res) => {
  res.json(responseEnvelope(req, { profiles: profileCatalog }))
})

router.post('/pos/print/profiles', (req, res) => {
  res.status(201).json(responseEnvelope(req, { profile: { ...req.body, updated_at: now() } }))
})

router.post('/pos/receipt/preview', (req, res) => {
  const order = req.body?.order || {}
  res.json(responseEnvelope(req, {
    preview: {
      document_type: 'POS_RECEIPT',
      copy_types: req.body?.copy_types || ['CUSTOMER_COPY', 'MERCHANT_COPY', 'RESORT_COPY'],
      order_id: order.id || null,
      invoice_no: order.invoice_no || order.order_no || null,
      document_hash: hashDocument([order.id, order.order_no, order.total]),
    },
  }))
})

router.post('/pos/receipt/print', (req, res) => {
  res.status(202).json(printJob(req, req.body?.copy_type || 'CUSTOMER_COPY'))
})

router.post('/pos/receipt/reprint', (req, res) => {
  res.status(202).json(printJob(req, 'REPRINT_COPY'))
})

router.post('/pos/receipt/pdf', (req, res) => {
  const order = req.body?.order || {}
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${order.order_no || 'POS Receipt'}</title></head><body><h1>POS Receipt</h1><p>${order.order_no || ''}</p></body></html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

router.post('/pos/kot/print', (req, res) => {
  res.status(202).json(printJob(req, 'KITCHEN_COPY'))
})

router.post('/pos/bot/print', (req, res) => {
  res.status(202).json(printJob(req, 'BAR_COPY'))
})

router.post('/pos/delivery-copy/print', (req, res) => {
  res.status(202).json(printJob(req, 'DELIVERY_COPY'))
})

router.post('/pos/resort-copy/print', (req, res) => {
  res.status(202).json(printJob(req, 'RESORT_COPY'))
})

router.get('/pos/print/logs', (req, res) => {
  res.json(responseEnvelope(req, { logs: [] }))
})

router.post('/pos/print/test-printer', (req, res) => {
  res.json(responseEnvelope(req, {
    test: {
      status: 'READY',
      printer_device: req.body?.printer_device || 'BROWSER',
      escpos_supported: true,
      auto_cut_supported: true,
      checked_at: now(),
    },
  }))
})

router.get('/pos/printer-routes', (req, res) => {
  res.json(responseEnvelope(req, { routes: [] }))
})

router.post('/pos/printer-routes', (req, res) => {
  res.status(201).json(responseEnvelope(req, { route: { ...req.body, created_at: now() } }))
})

export default router
