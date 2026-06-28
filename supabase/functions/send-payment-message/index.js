import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400)
  }

  const {
    channel,
    to,
    subject,
    message,
    attachment,
    reservation_id,
    payment_id,
  } = body || {}

  if (!channel || !to || !message) {
    return json({ error: 'channel, to, and message are required' }, 400)
  }

  if (attachment?.size && Number(attachment.size) > MAX_ATTACHMENT_BYTES) {
    return json({ error: 'Attachment too large (max 10MB)' }, 400)
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const paymentInfo = await getPaymentMeta(supabase, payment_id)

    if (channel === 'EMAIL') {
      const result = await sendEmail({ to, subject, message, attachment })
      await logDeliveryAttempt(supabase, {
        reservation_id,
        payment_id,
        payment_no: paymentInfo.paymentNo,
        tenant_id: paymentInfo.tenant_id,
        channel,
        recipient: to,
        status: 'SUCCESS',
        provider: 'resend',
        provider_message: result?.id || 'EMAIL_SENT',
      })
      return json({ ok: true, channel, provider: 'resend', result })
    }

    if (channel === 'WHATSAPP') {
      const result = await sendWhatsApp({ to, message, attachment, reservation_id, payment_id })
      await logDeliveryAttempt(supabase, {
        reservation_id,
        payment_id,
        payment_no: paymentInfo.paymentNo,
        tenant_id: paymentInfo.tenant_id,
        channel,
        recipient: to,
        status: 'SUCCESS',
        provider: 'twilio',
        provider_message: result?.sid || 'WHATSAPP_SENT',
      })
      return json({ ok: true, channel, provider: 'twilio', result })
    }

    return json({ error: 'Unsupported channel' }, 400)
  } catch (err) {
    console.error('[send-payment-message]', err)
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      )
      const paymentInfo = await getPaymentMeta(supabase, payment_id)
      await logDeliveryAttempt(supabase, {
        reservation_id,
        payment_id,
        payment_no: paymentInfo.paymentNo,
        tenant_id: paymentInfo.tenant_id,
        channel,
        recipient: to,
        status: 'FAILED',
        provider: channel === 'EMAIL' ? 'resend' : 'twilio',
        error_message: err?.message || 'Dispatch failed',
      })
    } catch (logErr) {
      console.error('[send-payment-message][log-failed]', logErr)
    }
    return json({ error: err?.message || 'Dispatch failed' }, 500)
  }
})

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sendEmail({ to, subject, message, attachment }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from) {
    throw new Error('Missing RESEND_API_KEY or RESEND_FROM_EMAIL secret')
  }

  const payload = {
    from,
    to: [to],
    subject: subject || 'Payment Receipt',
    text: message,
  }

  if (attachment?.base64 && attachment?.name) {
    payload.attachments = [
      {
        filename: attachment.name,
        content: attachment.base64,
      },
    ]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await safeJson(res)
  if (!res.ok) {
    throw new Error(data?.message || `Resend API failed with status ${res.status}`)
  }
  return data
}

async function sendWhatsApp({ to, message, attachment, reservation_id, payment_id }) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
  if (!sid || !token || !from) {
    throw new Error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_WHATSAPP_FROM secret')
  }

  const toNumber = normalizePhone(to)
  if (!toNumber) throw new Error('Invalid WhatsApp number')

  const params = new URLSearchParams()
  params.set('From', normalizeWhatsAppFrom(from))
  params.set('To', `whatsapp:${toNumber}`)
  params.set('Body', message)

  if (attachment?.base64 && attachment?.name) {
    const mediaUrl = await uploadAttachmentAndSignUrl({ attachment, reservation_id, payment_id })
    params.set('MediaUrl', mediaUrl)
  }

  const auth = btoa(`${sid}:${token}`)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const data = await safeJson(res)
  if (!res.ok) {
    throw new Error(data?.message || `Twilio API failed with status ${res.status}`)
  }
  return data
}

function normalizePhone(input) {
  const digits = String(input || '').replace(/[^\d+]/g, '')
  if (!digits) return null
  return digits.startsWith('+') ? digits : `+${digits}`
}

function normalizeWhatsAppFrom(value) {
  const v = String(value || '').trim()
  if (!v) return ''
  return v.startsWith('whatsapp:') ? v : `whatsapp:${v}`
}

async function uploadAttachmentAndSignUrl({ attachment, reservation_id, payment_id }) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const bucket = 'payment-message-attachments'
  await ensureBucket(supabase, bucket)

  const bytes = base64ToUint8Array(attachment.base64)
  const safeName = String(attachment.name || 'attachment.bin').replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${reservation_id || 'general'}/${payment_id || Date.now()}-${Date.now()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(key, bytes, {
      contentType: attachment.type || 'application/octet-stream',
      upsert: true,
    })

  if (upErr) throw new Error(`Attachment upload failed: ${upErr.message}`)

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, 60 * 60)

  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message || 'Could not create signed URL for attachment')
  }
  return data.signedUrl
}

async function ensureBucket(supabase, bucketName) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`Could not list buckets: ${error.message}`)
  const exists = (buckets || []).some((b) => b.name === bucketName)
  if (exists) return

  const { error: createErr } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: `${MAX_ATTACHMENT_BYTES}`,
  })
  if (createErr && !String(createErr.message || '').toLowerCase().includes('already exists')) {
    throw new Error(`Could not create bucket: ${createErr.message}`)
  }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function getPaymentMeta(supabase, paymentId) {
  if (!paymentId) return { paymentNo: null, tenant_id: null }
  const { data } = await supabase
    .from('payments')
    .select('tenant_id, reference')
    .eq('id', paymentId)
    .maybeSingle()

  const paymentNo = parsePaymentNo(data?.reference)
  return { paymentNo, tenant_id: data?.tenant_id || null }
}

function parsePaymentNo(reference) {
  const raw = String(reference || '').trim()
  if (!raw) return null
  const first = raw.split('|')[0]?.trim() || ''
  return /^RP-DEMO-\d{8,}$/.test(first) ? first : null
}

async function logDeliveryAttempt(supabase, payload) {
  const row = {
    tenant_id: payload.tenant_id || null,
    reservation_id: payload.reservation_id || null,
    payment_id: payload.payment_id || null,
    payment_no: payload.payment_no || null,
    channel: payload.channel || null,
    recipient: payload.recipient || null,
    status: payload.status || 'FAILED',
    provider: payload.provider || null,
    provider_message: payload.provider_message || null,
    error_message: payload.error_message || null,
  }
  await supabase.from('payment_delivery_logs').insert(row)
}
