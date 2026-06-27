import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { getTenantId } from '../lib/tenant'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

/**
 * IntegrationCallbackPage
 *
 * Handles the OAuth 2.0 redirect callback from QuickBooks or Xero.
 * The URL looks like:
 *   /accounting/integrations/callback?code=…&state=…&realmId=…
 *
 * 1. Reads code, state (base64-encoded { provider, tenant_id }) and realmId
 * 2. Calls the appropriate edge function with action='oauth-callback'
 * 3. Redirects back to /accounting/integrations with a flash message
 */
export default function IntegrationCallbackPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [status, setStatus] = useState('processing') // 'processing' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params   = new URLSearchParams(location.search)
    const code     = params.get('code')
    const rawState = params.get('state')
    const realmId  = params.get('realmId') || params.get('realm_id') || null
    const errorParam = params.get('error')

    if (errorParam) {
      setStatus('error')
      setMessage(`Provider denied access: ${errorParam}`)
      setTimeout(() => navigate('/accounting/integrations'), 4000)
      return
    }

    if (!code || !rawState) {
      setStatus('error')
      setMessage('Invalid callback — missing code or state parameter.')
      setTimeout(() => navigate('/accounting/integrations'), 4000)
      return
    }

    let stateObj = {}
    try {
      stateObj = JSON.parse(atob(rawState))
    } catch {
      setStatus('error')
      setMessage('Invalid state parameter in callback.')
      setTimeout(() => navigate('/accounting/integrations'), 4000)
      return
    }

    const { provider, tenant_id } = stateObj
    const tenantId = tenant_id || getTenantId()

    if (!provider || !['quickbooks', 'xero'].includes(provider)) {
      setStatus('error')
      setMessage(`Unknown provider in callback state: ${provider}`)
      setTimeout(() => navigate('/accounting/integrations'), 4000)
      return
    }

    const fnName = provider === 'quickbooks' ? 'sync-quickbooks' : 'sync-xero'

    supabase.functions.invoke(fnName, {
      body: {
        action:    'oauth-callback',
        tenant_id: tenantId,
        code,
        realm_id:  realmId,
      },
    }).then(({ data, error }) => {
      if (error) {
        setStatus('error')
        setMessage(error.message || 'Token exchange failed.')
        setTimeout(() => navigate('/accounting/integrations'), 5000)
        return
      }
      const company = data?.company_name ? ` (${data.company_name})` : ''
      setStatus('success')
      setMessage(`Successfully connected to ${provider}${company}!`)
      setTimeout(() => navigate('/accounting/integrations'), 3000)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-leaf/10">
      <div className="card p-8 max-w-sm w-full text-center space-y-4">
        {status === 'processing' && (
          <>
            <Loader2 size={40} className="animate-spin text-forest mx-auto" />
            <h2 className="font-display text-lg font-bold text-pine">Connecting…</h2>
            <p className="text-sm text-pine/60">Exchanging authorization tokens. Please wait.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="text-forest mx-auto" />
            <h2 className="font-display text-lg font-bold text-pine">Connected!</h2>
            <p className="text-sm text-pine/60">{message}</p>
            <p className="text-xs text-pine/40">Redirecting back to Integrations…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle size={40} className="text-red-500 mx-auto" />
            <h2 className="font-display text-lg font-bold text-pine">Connection Failed</h2>
            <p className="text-sm text-red-600">{message}</p>
            <p className="text-xs text-pine/40">Redirecting back to Integrations…</p>
          </>
        )}
      </div>
    </div>
  )
}
