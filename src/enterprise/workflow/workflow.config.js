/**
 * Workflow Engine — config-only workflow definitions.
 *
 * These definitions describe stages for future approval workflows.
 * Nothing here is enforced in business logic yet — creating a
 * purchase request, leave request, etc. today does NOT run through
 * this engine. This is a placeholder data shape for future wiring.
 */

/** @typedef {{ id: string, label: string }} WorkflowStage */
/** @typedef {{ type: string, label: string, stages: WorkflowStage[] }} WorkflowDefinition */

/** @type {WorkflowDefinition[]} */
export const WORKFLOW_DEFINITIONS = [
  {
    type: 'purchase_request',
    label: 'Purchase Request',
    stages: [
      { id: 'draft', label: 'Draft' },
      { id: 'department_review', label: 'Department Review' },
      { id: 'finance_approval', label: 'Finance Approval' },
      { id: 'approved', label: 'Approved' },
    ],
  },
  {
    type: 'leave_request',
    label: 'Leave Request',
    stages: [
      { id: 'draft', label: 'Draft' },
      { id: 'manager_approval', label: 'Manager Approval' },
      { id: 'hr_approval', label: 'HR Approval' },
      { id: 'approved', label: 'Approved' },
    ],
  },
  {
    type: 'payroll_approval',
    label: 'Payroll Approval',
    stages: [
      { id: 'draft', label: 'Draft' },
      { id: 'accounts_review', label: 'Accounts Review' },
      { id: 'management_approval', label: 'Management Approval' },
      { id: 'approved', label: 'Approved' },
    ],
  },
  {
    type: 'journal_approval',
    label: 'Journal Approval',
    stages: [
      { id: 'draft', label: 'Draft' },
      { id: 'accountant_review', label: 'Accountant Review' },
      { id: 'manager_approval', label: 'Manager Approval' },
      { id: 'posted', label: 'Posted' },
    ],
  },
  {
    type: 'refund_approval',
    label: 'Refund Approval',
    stages: [
      { id: 'requested', label: 'Requested' },
      { id: 'front_office_review', label: 'Front Office Review' },
      { id: 'finance_approval', label: 'Finance Approval' },
      { id: 'approved', label: 'Approved' },
    ],
  },
  {
    type: 'discount_approval',
    label: 'Discount Approval',
    stages: [
      { id: 'requested', label: 'Requested' },
      { id: 'supervisor_review', label: 'Supervisor Review' },
      { id: 'approved', label: 'Approved' },
    ],
  },
];
