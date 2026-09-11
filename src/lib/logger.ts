/**
 * Conditional logging utility
 * Only logs in development environment to prevent exposing sensitive data in production
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
    /**
     * Debug logging - only in development
     */
    debug: (...args: any[]) => {
        if (isDevelopment) {
            console.debug('[DEBUG]', ...args)
        }
    },

    /**
     * Info logging - only in development
     */
    info: (...args: any[]) => {
        if (isDevelopment) {
            console.info('[INFO]', ...args)
        }
    },

    /**
     * Warning logging - always shown
     */
    warn: (...args: any[]) => {
        console.warn('[WARN]', ...args)
    },

    /**
     * Error logging - always shown but sanitized in production
     */
    error: (...args: any[]) => {
        if (isDevelopment) {
            const formatted = args.map(arg => {
                if (arg instanceof Error) {
                    return `${arg.name}: ${arg.message}\n${arg.stack || ''}`
                }
                if (arg && typeof arg === 'object') {
                    if ('error' in arg && arg.error instanceof Error) {
                        return {
                            ...arg,
                            error: `${arg.error.name}: ${arg.error.message}`,
                            stack: arg.error.stack,
                        }
                    }
                }
                return arg
            })
            console.error('[ERROR]', ...formatted)
        } else {
            // In production, log minimal info without sensitive data
            console.error('[ERROR] An error occurred')
        }
    },

    /**
     * Security-sensitive logging - only in development
     * Use for session IDs, user IDs, tokens, etc.
     */
    security: (message: string, data?: any) => {
        if (isDevelopment) {
            console.log(`🔒 [SECURITY] ${message}`, data || '')
        }
    },

    /**
     * Session logging - only in development
     */
    session: (message: string, data?: any) => {
        if (isDevelopment) {
            console.log(`🔑 [SESSION] ${message}`, data || '')
        }
    }
}

export default logger
