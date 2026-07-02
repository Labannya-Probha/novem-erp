import React from 'react';
import { useReportBuilder } from './useReportBuilder';
import { REPORT_BUILDER_CONFIG } from './reportBuilder.config';

/**
 * ReportBuilderShell
 *
 * Shell only. Lets a user browse and "select" config-driven fields for
 * a future custom report, but does not generate SQL or an actual
 * report. Always shows the planned-feature empty state.
 *
 * @param {{ className?: string }} props
 */
export default function ReportBuilderShell({ className = '' }) {
  const { fields, selectedFieldKeys, toggleField } = useReportBuilder();

  return (
    <div className={`aera-report-builder-shell ${className}`} role="region" aria-label="Custom Report Builder">
      <p className="aera-empty-state" role="status">
        {REPORT_BUILDER_CONFIG.plannedMessage}
      </p>

      <fieldset disabled aria-label="Available report fields (preview only)">
        <legend>Available fields</legend>
        {fields.map((field) => (
          <label key={field.key}>
            <input
              type="checkbox"
              checked={selectedFieldKeys.includes(field.key)}
              onChange={() => toggleField(field.key)}
              aria-label={field.label}
            />
            {field.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
