
const isDev = true; // Set to false in production to disable console logs

/**
 * Logs an error message to the console.
 * @param {Error|string} e - The error or message to log.
 * @param {string} [ctx='General'] - The context of the error.
 */
function log(e: Error | string, ctx = 'General') {
    // In a real app, this would integrate with a service like Sentry
    if (isDev) {
        console.error(`[${ctx}]`, e);
    }
}

export const Logger = { log };
