import { supabase } from '../../supabase'
import { getTenantId } from '../tenant'
import { REPORT_TEMPLATES } from './reportConfig'

const REPORT_ROLE_ACCESS = {
  SUPERUSER: () => true,
  ADMIN: () => true,
  MANAGER: () => true,
  ACCOUNTS: (report) => ['IFRS', 'ACCOUNTING'].includes(report.category),
  FRONT_OFFICE: (report) => report.category === 'HOTEL_KPI',
  RESTAURANT: (report) => report.category === 'POS',
  STORE: (report) => ['INV-MOV'].includes(report.code),
  HR: (report) => ['HOTEL_KPI', 'ACCOUNTING'].includes(report.category),
  HOUSEKEEPING: (report) => ['HK-STATUS', 'ROOM-AVAIL'].includes(report.code),
}

const permissionFor = (role, report) => (REPORT_ROLE_ACCESS[role] || (() => false))(report)

export function getRoleDefaultReportCatalog(role = 'FRONT_OFFICE') {
  return REPORT_TEMPLATES.filter((report) => permissionFor(role, report))
}

export async function loadTenantReportCatalog({ role = 'FRONT_OFFICE', userId = null } = {}) {
  if (!supabase) {
    return getRoleDefaultReportCatalog(role)
  }

  const { data, error } = await supabase
    .from('report_user_access')
    .select('can_view, can_export, can_print, role, user_id, report_templates(report_code)')
    .or(`role.eq.${role},user_id.eq.${userId || '00000000-0000-0000-0000-000000000000'}`)

  if (error) {
    console.warn('Tenant report access unavailable, using role defaults.', error.message)
    return getRoleDefaultReportCatalog(role)
  }

  const accessByCode = new Map(
    (data || [])
      .map((row) => [row.report_templates?.report_code, row])
      .filter(([code]) => code)
  )

  return REPORT_TEMPLATES
    .filter((report) => {
      const access = accessByCode.get(report.code)
      return access ? access.can_view !== false : permissionFor(role, report)
    })
    .map((report) => {
      const access = accessByCode.get(report.code)
      return {
        ...report,
        exportPermission: access ? !!access.can_export : report.exportPermission,
        printPermission: access ? !!access.can_print : report.printPermission,
      }
    })
}

async function getReportTemplateId(reportCode) {
  if (!supabase) return null
  const { data } = await supabase
    .from('report_templates')
    .select('id')
    .eq('report_code', reportCode)
    .maybeSingle()
  return data?.id || null
}

export async function logReportExport({ report, format, filters, userId, userName }) {
  if (!supabase) return
  const reportTemplateId = await getReportTemplateId(report.code)
  const tenantId = getTenantId()
  await supabase.from('report_export_logs').insert({
    tenant_id: tenantId,
    report_template_id: reportTemplateId,
    report_code: report.code,
    export_format: format,
    filters,
    generated_by: userId || null,
    generated_by_name: userName || null,
  })
}

export async function logReportPrint({ report, pageSize, filters, userId, userName }) {
  if (!supabase) return
  const reportTemplateId = await getReportTemplateId(report.code)
  const tenantId = getTenantId()
  await supabase.from('report_print_logs').insert({
    tenant_id: tenantId,
    report_template_id: reportTemplateId,
    report_code: report.code,
    page_size: pageSize,
    filters,
    printed_by: userId || null,
    printed_by_name: userName || null,
  })
}

export function getTenantReportContext(company, role) {
  return {
    tenantId: getTenantId(),
    tenantName: company?.name || 'Tenant',
    propertyName: company?.property_name || company?.name || 'Property',
    role,
    currency: company?.currency || 'BDT',
  }
}
