import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

describe('Login', () => {
  beforeAll(() => {
    vi.stubGlobal('window', { sessionStorage: storage })
  })

  it('keeps the password visibility toggle keyboard focusable', async () => {
    const { default: Login } = await import('./Login')
    const markup = renderToStaticMarkup(<Login slug="demo-property" />)

    expect(markup).toContain('aria-pressed="false"')
    expect(markup).not.toContain('tabindex="-1"')
  })
})
