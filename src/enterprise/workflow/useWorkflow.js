import { useMemo } from 'react';
import { WORKFLOW_DEFINITIONS } from './workflow.config';

/**
 * useWorkflow
 *
 * Read-only lookup over the config-defined workflow stages. Does not
 * enforce any workflow in business logic — it only exposes stage
 * metadata for a given workflow type so UI (e.g. ApprovalTimeline) can
 * render "stage 2 of 4" style progress once real approval records
 * exist.
 *
 * @param {string} workflowType one of WORKFLOW_DEFINITIONS[].type
 */
export function useWorkflow(workflowType) {
  const definition = useMemo(
    () => WORKFLOW_DEFINITIONS.find((w) => w.type === workflowType) || null,
    [workflowType]
  );

  return {
    definition,
    stages: definition?.stages || [],
    isDefined: Boolean(definition),
    allDefinitions: WORKFLOW_DEFINITIONS,
  };
}
