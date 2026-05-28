import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CheckSquare } from 'lucide-react'
import StatsPill from '../components/StatsPill'

describe('StatsPill', () => {
  it('renders count', () => {
    render(<StatsPill icon={CheckSquare} count={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<StatsPill icon={CheckSquare} count={3} label="مهام" />)
    expect(screen.getByText('مهام')).toBeInTheDocument()
  })

  it('does not render label when not provided', () => {
    render(<StatsPill icon={CheckSquare} count={3} />)
    expect(screen.queryByText('مهام')).not.toBeInTheDocument()
  })

  it('applies default blue palette', () => {
    render(<StatsPill icon={CheckSquare} count={1} />)
    const span = screen.getByText('1')
    expect(span.className).toContain('bg-blue-50')
    expect(span.className).toContain('text-blue-700')
  })

  it('applies custom color palette', () => {
    render(<StatsPill icon={CheckSquare} count={2} color="green" />)
    const span = screen.getByText('2')
    expect(span.className).toContain('bg-green-50')
    expect(span.className).toContain('text-green-700')
  })
})
