import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import EnterpriseReportFooter from './EnterpriseReportFooter'

describe('EnterpriseReportFooter', () => {
  it('keeps backward-compatible footer prop aliases', () => {
    const markup = renderToStaticMarkup(
      <EnterpriseReportFooter
        printedBy="Alice"
        printedTime="2026-07-02 10:00"
        pageLabel="2 of 5"
      />
    )

    expect(markup).toContain('Alice')
    expect(markup).toContain('2026-07-02 10:00')
    expect(markup).toContain('2 of 5')
  })
})

