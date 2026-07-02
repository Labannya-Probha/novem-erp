/**
 * Report Builder — config-driven field catalogue only.
 *
 * No SQL/report generation is implemented. This lists the fields a
 * future custom report builder would let users pick from.
 */

/** @typedef {{ key: string, label: string, source: string }} ReportBuilderField */

/** @type {ReportBuilderField[]} */
export const REPORT_BUILDER_FIELDS = [
  { key: 'reservation_date', label: 'Reservation Date', source: 'reservations' },
  { key: 'guest_name', label: 'Guest Name', source: 'guests' },
  { key: 'room_type', label: 'Room Type', source: 'rooms' },
  { key: 'invoice_total', label: 'Invoice Total', source: 'invoices' },
  { key: 'account_code', label: 'Account Code', source: 'chart_of_accounts' },
  { key: 'employee_department', label: 'Employee Department', source: 'employees' },
];

export const REPORT_BUILDER_CONFIG = {
  plannedMessage: 'Custom Report Builder is planned.',
};
