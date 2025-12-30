import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock UI components to avoid alias resolution issues and heavy renders
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}), { virtual: true })
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>
}), { virtual: true })
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>
}), { virtual: true })
vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}), { virtual: true })

// Mock domain utilities used by the page
vi.mock('@/lib/repair-predictive', () => ({
  predictRepairTime: () => 1
}), { virtual: true })
vi.mock('@/services/repair-priority', () => ({
  calculatePriorityScore: () => 1
}), { virtual: true })

// Mock realtime hook to no-op
vi.mock('@/hooks/useRepairsRealtime', () => ({
  useRepairsRealtime: () => {}
}), { virtual: true })

import Page from './page'

const subscribe = vi.fn()
const unsubscribe = vi.fn()
const chain: any = { on: vi.fn(() => chain), subscribe, unsubscribe }

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ channel: vi.fn(() => chain) })
}))

describe('Repairs Kanban Page', () => {
  beforeEach(() => {
    subscribe.mockClear()
    unsubscribe.mockClear()
    chain.on.mockClear()
  })

  it('renders and loads repairs from API', async () => {
    const repairs = [
      { id: 'K-100', customerName: 'Juan', deviceModel: 'iPhone 14 Pro', issueDescription: 'Pantalla rota', createdAt: new Date().toISOString(), urgency: 5, technicalComplexity: 3, stage: 'received', historicalValue: 1200 },
      { id: 'K-101', customerName: 'Ana', deviceModel: 'Galaxy S22', issueDescription: 'Batería no carga', createdAt: new Date().toISOString(), urgency: 3, technicalComplexity: 2, stage: 'in_repair', historicalValue: 800 }
    ]
    global.fetch = vi.fn(async (url: any) => {
      if (url === '/api/repairs') {
        return new Response(JSON.stringify({ repairs }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url === '/api/prioritization/score') {
        return new Response(JSON.stringify({ score: 1.23 }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('{}', { status: 404 })
    }) as any

    render(<Page />)

    await waitFor(() => {
      expect(screen.getByText('iPhone 14 Pro')).toBeTruthy()
      expect(screen.getByText('Galaxy S22')).toBeTruthy()
    })
  })
})