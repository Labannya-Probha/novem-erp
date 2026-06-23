/**
 * Branding utilities — theme building, CSS variable application,
 * and resolution from company_settings.
 */

export const DEFAULT_THEME = {
  primary:      '#1F6F78',
  accent:       '#2E7D32',
  printPrimary: '#1B4D2E',
  printAccent:  '#2E7D32',
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
    accent:       config.accent       || DEFAULT_THEME.accent,
    printPrimary: config.printPrimary || DEFAULT_THEME.printPrimary,
    printAccent:  config.printAccent  || DEFAULT_THEME.printAccent,
  }
}

/**
 * Apply a theme object to the document root as CSS custom properties.
 *
 * @param {{ primary: string, accent: string, printPrimary: string, printAccent: string }} theme
 */
export function applyBrandTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--brand-color',        theme.primary)
  root.style.setProperty('--brand-accent',        theme.accent)
  root.style.setProperty('--brand-print-primary', theme.printPrimary)
  root.style.setProperty('--brand-print-accent',  theme.printAccent)
  root.style.setProperty('--sidebar-bg',          theme.printPrimary)
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
    accent:       company?.accent_color   || DEFAULT_THEME.accent,
    printPrimary: company?.brand_primary  || DEFAULT_THEME.printPrimary,
    printAccent:  company?.brand_accent   || DEFAULT_THEME.printAccent,
  })
}
