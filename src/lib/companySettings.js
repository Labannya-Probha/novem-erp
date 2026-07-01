import { supabase } from '../supabase'
import { getTenantId } from './tenant'

export function withTenantScope(query, tenantId = getTenantId()) {
  return tenantId ? query.eq('tenant_id', tenantId) : query
}

export function getCompanySettingsQuery(columns = '*', tenantId = getTenantId()) {
  return withTenantScope(supabase.from('company_settings').select(columns), tenantId)
}

export function getPrintBrandProps(company) {
  return {
    primaryColor: company?.primary_color || company?.brand_primary,
    accentColor: company?.accent_color || company?.brand_accent,
  }
}
