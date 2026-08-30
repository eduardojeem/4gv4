import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TurnstileChallenge } from './TurnstileChallenge'

type WidgetProps = {
  injectScript?: boolean
  onSuccess: (token: string) => void
  onExpire: () => void
  onError: () => void
}

let widgetProps: WidgetProps | null = null
let scriptProps: { src: string } | null = null

vi.mock('next/script', () => ({
  default: (props: { src: string }) => {
    scriptProps = props
    return null
  },
}))

vi.mock('@marsidev/react-turnstile', async () => {
  const React = await import('react')
  const MockTurnstile = React.forwardRef<unknown, WidgetProps>((props, ref) => {
    void ref
    React.useEffect(() => {
      widgetProps = props
    }, [props])
    return <div data-testid="turnstile-widget" />
  })
  MockTurnstile.displayName = 'MockTurnstile'
  return {
    Turnstile: MockTurnstile,
  }
})

describe('TurnstileChallenge', () => {
  beforeEach(() => {
    widgetProps = null
    scriptProps = null
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports successful, expired, and failed verification without exposing the token', () => {
    const onTokenChange = vi.fn()
    render(<TurnstileChallenge action="login" onTokenChange={onTokenChange} resetKey={0} />)

    expect(scriptProps?.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
    expect(widgetProps?.injectScript).toBe(false)

    act(() => widgetProps?.onSuccess('private-captcha-token'))
    expect(onTokenChange).toHaveBeenLastCalledWith('private-captcha-token')
    expect(screen.getByRole('status')).toHaveTextContent('Verificacion completada')
    expect(screen.queryByText('private-captcha-token')).not.toBeInTheDocument()

    act(() => widgetProps?.onExpire())
    expect(onTokenChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('alert')).toHaveTextContent('vencio')

    act(() => widgetProps?.onError())
    expect(onTokenChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos completar')
  })

  it('remounts the widget when resetKey changes', () => {
    const onTokenChange = vi.fn()
    const { rerender } = render(
      <TurnstileChallenge action="login" onTokenChange={onTokenChange} resetKey={0} />,
    )
    act(() => widgetProps?.onSuccess('token'))

    rerender(<TurnstileChallenge action="login" onTokenChange={onTokenChange} resetKey={1} />)

    expect(screen.getByRole('status')).toHaveTextContent('Completa la verificacion')
  })

  it('shows a safe configuration error when the public site key is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')

    render(<TurnstileChallenge action="login" onTokenChange={vi.fn()} resetKey={0} />)

    expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('proteccion anti-bots no esta configurada')
  })
})
