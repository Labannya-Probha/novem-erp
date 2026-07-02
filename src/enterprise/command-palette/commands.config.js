/**
 * Command Palette — config-driven, non-destructive navigation commands.
 *
 * Each command is a plain navigation action. No destructive commands
 * (delete, void, cancel, etc.) are included by design — the palette is
 * an extension point, not a place to short-circuit confirmations.
 *
 * To add more commands later, append entries here rather than hardcoding
 * them in CommandPalette.jsx.
 */

/** @typedef {{ id: string, label: string, path: string, keywords?: string[] }} CommandConfig */

/** @type {CommandConfig[]} */
export const COMMANDS = [
  { id: 'go-dashboard', label: 'Go to Dashboard', path: '/dashboard', keywords: ['home', 'overview'] },
  { id: 'go-reservations', label: 'Go to Reservations', path: '/reservations', keywords: ['booking', 'calendar'] },
  { id: 'go-front-office', label: 'Go to Front Office', path: '/front-office', keywords: ['checkin', 'checkout'] },
  { id: 'go-restaurant', label: 'Go to Restaurant', path: '/restaurant', keywords: ['pos', 'kot', 'menu'] },
  { id: 'go-accounting', label: 'Go to Accounting', path: '/accounting', keywords: ['ledger', 'vat', 'voucher'] },
  { id: 'go-reports', label: 'Go to Reports', path: '/reports', keywords: ['report', 'pnl', 'balance sheet'] },
  { id: 'go-settings', label: 'Go to Settings', path: '/settings', keywords: ['config', 'preferences'] },
];

export const COMMAND_PALETTE_CONFIG = {
  /** Keyboard shortcut, informational only — actual binding lives in the hook. */
  shortcutLabel: 'Ctrl+K',
};
