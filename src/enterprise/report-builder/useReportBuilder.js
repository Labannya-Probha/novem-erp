import { useState } from 'react';
import { REPORT_BUILDER_FIELDS } from './reportBuilder.config';

/**
 * useReportBuilder
 *
 * UI-shell state only: tracks which config-driven fields the user has
 * selected. Does not generate SQL or reports — that is intentionally
 * left unimplemented.
 */
export function useReportBuilder() {
  const [selectedFieldKeys, setSelectedFieldKeys] = useState([]);

  function toggleField(key) {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return {
    fields: REPORT_BUILDER_FIELDS,
    selectedFieldKeys,
    toggleField,
    isImplemented: false,
  };
}
