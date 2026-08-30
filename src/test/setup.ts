import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window, 'innerWidth', {
  configurable: true,
  value: 1366,
  writable: true,
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1366,
    writable: true,
  })
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    const maxWidth = /max-width:\s*(\d+)px/.exec(query)?.[1]
    const minWidth = /min-width:\s*(\d+)px/.exec(query)?.[1]
    const matchesMax = !maxWidth || window.innerWidth <= Number(maxWidth)
    const matchesMin = !minWidth || window.innerWidth >= Number(minWidth)
    return {
      matches: matchesMax && matchesMin,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }
  },
})
