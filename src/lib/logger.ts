/**
 * Conditional logging utility
 * Only logs in development environment to prevent exposing sensitive data in production
 */

const isDevelopment = process.env.NODE_ENV === 'development'
// Los logs del servidor (rutas API, Server Components) van a los Function
// Logs de Vercel, privados para quien administra el proyecto: nunca llegan al
// navegador de un visitante. Solo el logging que corre en el cliente necesita
// la version sanitizada; en el servidor, ocultar el error en produccion no
// evita ninguna fuga, solo hace imposible diagnosticar el fallo despues.
const isServer = typeof window === 'undefined'
const showFullErrors = isDevelopment || isServer

export const logger = {
    /**
     * Debug logging - only in development
     */
    debug: (...args: unknown[]) => {
        if (isDevelopment) {
            console.debug('[DEBUG]', ...args)
        }
    },

    /**
     * Info logging - only in development
     */
    info: (...args: unknown[]) => {
        if (isDevelopment) {
            console.info('[INFO]', ...args)
        }
    },

    /**
     * Warning logging - always shown
     */
    warn: (...args: unknown[]) => {
        console.warn('[WARN]', ...args)
    },

    /**
     * Error logging - always shown but sanitized in production
     */
    error: (...args: unknown[]) => {
        if (showFullErrors) {
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

        // Registrar en Supabase y enviar alerta a Telegram (si configurado)
        if (process.env.NODE_ENV !== 'test') {
            void dispatchError(args)
        }
    },

    /**
     * Security-sensitive logging - only in development
     * Use for session IDs, user IDs, tokens, etc.
     */
    security: (message: string, data?: unknown) => {
        if (isDevelopment) {
            console.log(`🔒 [SECURITY] ${message}`, data || '')
        }
    },

    /**
     * Session logging - only in development
     */
    session: (message: string, data?: unknown) => {
        if (isDevelopment) {
            console.log(`🔑 [SESSION] ${message}`, data || '')
        }
    }
}

export default logger

function extractErrorInfo(args: unknown[]): { name: string; message: string; stack?: string } {
    let name = 'Error'
    let message = ''
    let stack: string | undefined

    for (const arg of args) {
        if (arg instanceof Error) {
            name = arg.name
            message = arg.message
            stack = arg.stack
            break
        } else if (typeof arg === 'string' && !message) {
            message = arg
        } else if (arg && typeof arg === 'object') {
            if ('error' in arg && (arg as { error: unknown }).error instanceof Error) {
                const err = (arg as { error: Error }).error
                name = err.name
                message = err.message
                stack = err.stack
                break
            } else if ('message' in arg && typeof (arg as { message: unknown }).message === 'string') {
                message = (arg as { message: string }).message
            }
        }
    }

    if (!message && args.length > 0) {
        try {
            message = String(args[0])
        } catch {
            message = 'Error sin descripción'
        }
    }

    return { name, message: message || 'Error sin mensaje', stack }
}

let isDispatching = false
async function dispatchError(args: unknown[]): Promise<void> {
    if (isDispatching) return
    isDispatching = true
    try {
        const { name, message, stack } = extractErrorInfo(args)
        if (isServer) {
            const { recordServerError } = await import('@/lib/logging/error-reporter')
            await recordServerError({
                name,
                message,
                stack,
                source: 'server',
            })
        } else {
            const { recordClientError } = await import('@/lib/logging/error-reporter')
            recordClientError({
                name,
                message,
                stack,
                source: 'client',
            })
        }
    } catch {
        // Silenciar para evitar bucles o caídas en cascada
    } finally {
        isDispatching = false
    }
}
