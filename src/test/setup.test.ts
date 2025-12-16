import { describe, it, expect } from 'vitest'

describe('Vitest setup', () => {
  it('should run tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have access to DOM matchers', () => {
    const div = document.createElement('div')
    div.textContent = 'Hello'
    expect(div).toHaveTextContent('Hello')
  })
})
