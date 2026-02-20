
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { useCallback } from 'react'

export function useRecaptcha() {
  const { executeRecaptcha } = useGoogleReCaptcha()

  const execute = useCallback(async (action: string) => {
    try {
      if (!executeRecaptcha) {
        console.warn('Recaptcha not ready')
        return ''
      }
      return await executeRecaptcha(action)
    } catch (error) {
      console.error('Execute recaptcha failed', error)
      return ''
    }
  }, [executeRecaptcha])

  return { executeRecaptcha: execute }
}
