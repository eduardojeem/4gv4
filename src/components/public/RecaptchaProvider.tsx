'use client'

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { ReactNode } from 'react'

interface RecaptchaProviderProps {
  children: ReactNode
}

export function RecaptchaProvider({ children }: RecaptchaProviderProps) {
  // Use environment variable or Google's test key as fallback
  // This prevents "Context Not Implemented" errors if the key is missing
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
  
  if (!recaptchaKey) {
    console.warn('reCAPTCHA site key not configured')
    return <>{children}</>
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  )
}
