import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast, toast } from '../components/Toast'

function TestButton() {
  const { toast: showToast } = useToast()
  return <button onClick={() => showToast('رسالة اختبار')}>إظهار</button>
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders children', () => {
    render(<ToastProvider><div>محتوى</div></ToastProvider>)
    expect(screen.getByText('محتوى')).toBeInTheDocument()
  })

  it('shows toast when triggered', () => {
    render(<ToastProvider><TestButton /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'إظهار' }))
    expect(screen.getByText('رسالة اختبار')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('removes toast after 4 seconds', () => {
    render(<ToastProvider><TestButton /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'إظهار' }))
    expect(screen.getByText('رسالة اختبار')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.queryByText('رسالة اختبار')).not.toBeInTheDocument()
  })

  it('global toast function works', () => {
    render(<ToastProvider><div /></ToastProvider>)
    act(() => { toast('رسالة عامة') })
    expect(screen.getByText('رسالة عامة')).toBeInTheDocument()
  })
})
