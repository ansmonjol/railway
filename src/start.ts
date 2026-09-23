import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

// Server functions only answer same-origin requests (Sec-Fetch-Site, then Origin),
// on top of the SameSite=Lax session cookie.
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })

// No SSR: the server only renders the HTML shell; routes render in the browser.
export const startInstance = createStart(() => ({ defaultSsr: false, requestMiddleware: [csrf] }))
