import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from '../components/ErrorBoundary'

function AlwaysCrash(): React.ReactNode {
  throw new Error('اختبار خطأ')
}

interface CrashProps { countRef: { current: number } }
function CrashesNTimes({ countRef }: CrashProps): React.ReactNode {
  if (countRef.current < 2) {
    countRef.current++
    throw new Error('اختبار خطأ')
  }
  return <div>محتوى سليم</div>
}

const ConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})
afterEach(() => {
  console.error = ConsoleError
})

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><div>محتوى سليم</div></ErrorBoundary>)
    expect(screen.getByText('محتوى سليم')).toBeInTheDocument()
  })

  it('renders fallback UI on error', () => {
    render(<ErrorBoundary><AlwaysCrash /></ErrorBoundary>)
    expect(screen.getByText('حدث خطأ غير متوقع')).toBeInTheDocument()
    expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument()
  })

  it('retry button recovers from transient error', async () => {
    const user = userEvent.setup()
    const counter = { current: 0 }
    render(<ErrorBoundary><CrashesNTimes countRef={counter} /></ErrorBoundary>)
    expect(screen.getByText('حدث خطأ غير متوقع')).toBeInTheDocument()
    await user.click(screen.getByText('إعادة المحاولة'))
    expect(screen.getByText('محتوى سليم')).toBeInTheDocument()
  })
})
