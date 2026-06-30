/**
 * Branding utilities — theme building, CSS variable application,
 * and resolution from company_settings.
 * 
 * Supports dynamic tenant color palette across all UI components.
 */

export const DEFAULT_THEME = {
  primary:      '#1F6F78',
  secondary:    '#EAF4F1',
  accent:       '#2E7D32',
  printPrimary: '#1B4D2E',
  printAccent:  '#2E7D32',
  sidebarBg:    '#123F2A',
  sidebarText:  '#FFFFFF',
  buttonColor:  '#1F6F78',
  tableHeader:  '#EAF4F1',
  reportHeader: '#0F4C81',
  fontFamily:   'Inter',
  themeMode:    'light',
}

/**
 * Build a normalised theme object from a raw config.
 * Falls back to DEFAULT_THEME for any missing value.
 *
 * @param {object} config
 * @returns {{ primary: string, accent: string, printPrimary: string, printAccent: string }}
 */
export function buildBrandTheme(config = {}) {
  return {
    primary:      config.primary      || DEFAULT_THEME.primary,
    secondary:    config.secondary    || DEFAULT_THEME.secondary,
    accent:       config.accent       || DEFAULT_THEME.accent,
    printPrimary: config.printPrimary || DEFAULT_THEME.printPrimary,
    printAccent:  config.printAccent  || DEFAULT_THEME.printAccent,
    sidebarBg:    config.sidebarBg    || DEFAULT_THEME.sidebarBg,
    sidebarText:  config.sidebarText  || DEFAULT_THEME.sidebarText,
    buttonColor:  config.buttonColor  || config.primary || DEFAULT_THEME.buttonColor,
    tableHeader:  config.tableHeader  || DEFAULT_THEME.tableHeader,
    reportHeader: config.reportHeader || DEFAULT_THEME.reportHeader,
    fontFamily:   config.fontFamily   || DEFAULT_THEME.fontFamily,
    themeMode:    config.themeMode    || DEFAULT_THEME.themeMode,
  }
}

/**
 * Convert hex color to RGB channels (no commas)
 * @param {string} hex - Hex color value (e.g., "#1F6F78")
 * @returns {string} RGB channels (e.g., "31 111 120")
 */
function hexToRgbChannels(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '31 111 120' // fallback to default
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ].join(' ')
}

/**
 * Apply a theme object to the document root as CSS custom properties.
 * Updates both static color names and dynamic RGB channels for alpha transparency.
 *
 * @param {{ primary: string, accent: string, printPrimary: string, printAccent: string }} theme
 */
export function applyBrandTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  
  // Primary color and its RGB channels
  const primaryRgb = hexToRgbChannels(theme.primary)
  const secondaryRgb = hexToRgbChannels(theme.secondary)
  const accentRgb = hexToRgbChannels(theme.accent)
  const darkRgb = hexToRgbChannels(theme.printPrimary)
  const buttonRgb = hexToRgbChannels(theme.buttonColor)
  
  // Set CSS custom properties
  root.style.setProperty('--tenant-primary', theme.primary)
  root.style.setProperty('--tenant-primary-rgb', primaryRgb)
  root.style.setProperty('--tenant-secondary', theme.secondary)
  root.style.setProperty('--tenant-secondary-rgb', secondaryRgb)
  root.style.setProperty('--tenant-accent', theme.accent)
  root.style.setProperty('--tenant-accent-rgb', accentRgb)
  root.style.setProperty('--tenant-dark', theme.printPrimary)
  root.style.setProperty('--tenant-dark-rgb', darkRgb)
  root.style.setProperty('--tenant-button', theme.buttonColor)
  root.style.setProperty('--tenant-button-rgb', buttonRgb)
  root.style.setProperty('--tenant-font-family', `"${theme.fontFamily}", "Inter", sans-serif`)
  
  // Legacy properties for backward compatibility
  root.style.setProperty('--brand-color', theme.primary)
  root.style.setProperty('--brand-accent', theme.accent)
  root.style.setProperty('--brand-print-primary', theme.printPrimary)
  root.style.setProperty('--brand-print-accent', theme.printAccent)
  root.style.setProperty('--sidebar-bg', theme.sidebarBg)
  root.style.setProperty('--sidebar-text', theme.sidebarText)
  root.style.setProperty('--button-bg', theme.buttonColor)
  root.style.setProperty('--table-header-bg', theme.tableHeader)
  root.style.setProperty('--report-header-bg', theme.reportHeader)
  root.dataset.themeMode = theme.themeMode
  root.classList.toggle('tenant-dark', theme.themeMode === 'dark')
}

/**
 * Resolve the brand theme from a company_settings record.
 * Returns a promise so the caller can await it consistently.
 *
 * @param {object|null} company  Row from company_settings (may be null)
 * @returns {Promise<{ primary: string, accent: string, printPrimary: string, printAccent: string }>}
 */
export async function resolveBrandTheme(company) {
  return buildBrandTheme({
    primary:      company?.primary_color  || DEFAULT_THEME.primary,
    secondary:    company?.secondary_color || DEFAULT_THEME.secondary,
    accent:       company?.accent_color   || DEFAULT_THEME.accent,
    printPrimary: company?.brand_primary  || DEFAULT_THEME.printPrimary,
    printAccent:  company?.brand_accent   || DEFAULT_THEME.printAccent,
    sidebarBg:    company?.sidebar_bg_color || company?.brand_primary || DEFAULT_THEME.sidebarBg,
    sidebarText:  company?.sidebar_text_color || DEFAULT_THEME.sidebarText,
    buttonColor:  company?.button_color || company?.primary_color || DEFAULT_THEME.buttonColor,
    tableHeader:  company?.table_header_color || DEFAULT_THEME.tableHeader,
    reportHeader: company?.report_header_color || company?.brand_primary || DEFAULT_THEME.reportHeader,
    fontFamily:   company?.font_family || DEFAULT_THEME.fontFamily,
    themeMode:    company?.theme_mode || DEFAULT_THEME.themeMode,
  })
}
