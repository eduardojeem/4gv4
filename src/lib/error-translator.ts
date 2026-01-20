/**
 * Error translation utility
 * Converts technical database/API errors into user-friendly messages
 */

export interface ErrorMapping {
    code?: string
    pattern?: RegExp
    message: string
}

const ERROR_MAPPINGS: ErrorMapping[] = [
    {
        code: 'PGRST116',
        message: 'No se pudo conectar con el servidor. Verifica tu conexión.'
    },
    {
        code: '23505',
        message: 'Este registro ya existe en el sistema.'
    },
    {
        code: '23503',
        message: 'No se puede completar la operación debido a referencias existentes.'
    },
    {
        code: '42501',
        message: 'No tienes permisos para realizar esta acción.'
    },
    {
        pattern: /auth|authentication/i,
        message: 'Error de autenticación. Por favor, inicia sesión nuevamente.'
    },
    {
        pattern: /network|connection/i,
        message: 'Error de conexión. Revisa tu conexión a internet.'
    },
    {
        pattern: /timeout/i,
        message: 'La operación tomó demasiado tiempo. Por favor, intenta de nuevo.'
    },
    {
        pattern: /duplicate/i,
        message: 'Ya existe un registro con estos datos.'
    },
    {
        pattern: /foreign key/i,
        message: 'No se puede completar debido a dependencias.'
    },
    {
        pattern: /not found/i,
        message: 'No se encontró el recurso solicitado.'
    }
]

export function translateError(error: any): string {
    if (!error) {
        return 'Ocurrió un error inesperado'
    }

    // Check for error code
    if (error.code) {
        const mapping = ERROR_MAPPINGS.find(m => m.code === error.code)
        if (mapping) return mapping.message
    }

    // Check error message patterns
    const errorMessage = error.message || error.toString()
    for (const mapping of ERROR_MAPPINGS) {
        if (mapping.pattern && mapping.pattern.test(errorMessage)) {
            return mapping.message
        }
    }

    // Return sanitized generic message
    return 'Error al procesar la solicitud. Por favor, intenta de nuevo.'
}

export function logAndTranslateError(error: any, context?: string): string {
    // Log full error for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
        console.error(`[Error${context ? ` - ${context}` : ''}]:`, error)
    }

    return translateError(error)
}
