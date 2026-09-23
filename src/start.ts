import { createStart } from '@tanstack/react-start'

// No SSR: the server only renders the HTML shell; routes render in the browser.
export const startInstance = createStart(() => ({ defaultSsr: false }))
