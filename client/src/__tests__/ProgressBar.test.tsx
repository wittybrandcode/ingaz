import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProgressBar from '../components/ProgressBar'

describe('ProgressBar', () => {
  it('renders with correct width', () => {
    const { container } = render(<ProgressBar value={75} />)
    const bar = container.querySelector('div[style*="width"]')
    expect(bar).toHaveStyle({ width: '75%' })
  })

  it('clamps value to 0 minimum', () => {
    const { container } = render(<ProgressBar value={-20} />)
    const bar = container.querySelector('div[style*="width"]')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('clamps value to 100 maximum', () => {
    const { container } = render(<ProgressBar value={150} />)
    const bar = container.querySelector('div[style*="width"]')
    expect(bar).toHaveStyle({ width: '100%' })
  })

  it('shows label when showLabel is true', () => {
    render(<ProgressBar value={50} showLabel />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    render(<ProgressBar value={50} />)
    expect(screen.queryByText('50%')).not.toBeInTheDocument()
  })

  it('applies green color at 100%', () => {
    const { container } = render(<ProgressBar value={100} />)
    const bar = container.querySelector('div[style*="width"]')
    expect(bar?.className).toContain('bg-green-500')
  })

  it('applies amber color at 50-99%', () => {
    const { container } = render(<ProgressBar value={75} />)
    const bar = container.querySelector('div[style*="width"]')
    expect(bar?.className).toContain('bg-amber-500')
  })

  it('applies blue color below 50%', () => {
    const { container } = render(<ProgressBar value={30} />)
    const bar = container.querySelector('div[style*="width"]')
    expect(bar?.className).toContain('bg-blue-500')
  })
})
