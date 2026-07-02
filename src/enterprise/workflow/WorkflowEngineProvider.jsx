import React, { createContext, useContext, useMemo } from 'react';
import { WORKFLOW_DEFINITIONS } from './workflow.config';

/**
 * WorkflowEngineContext
 *
 * Provides read-only access to config-defined workflow definitions
 * (purchase_request, leave_request, payroll_approval, journal_approval,
 * refund_approval, discount_approval) throughout the app.
 *
 * This is a config/context placeholder only — it does not execute or
 * enforce workflows. No Supabase calls are made here.
 */
const WorkflowEngineContext = createContext({ definitions: WORKFLOW_DEFINITIONS });

/**
 * WorkflowEngineProvider
 *
 * Wrap the app (or a module) with this to make workflow definitions
 * available via `useContext(WorkflowEngineContext)` or the
 * `useWorkflow` hook.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function WorkflowEngineProvider({ children }) {
  const value = useMemo(() => ({ definitions: WORKFLOW_DEFINITIONS }), []);
  return (
    <WorkflowEngineContext.Provider value={value}>
      {children}
    </WorkflowEngineContext.Provider>
  );
}

export function useWorkflowEngineContext() {
  return useContext(WorkflowEngineContext);
}
