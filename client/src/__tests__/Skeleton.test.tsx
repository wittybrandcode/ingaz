import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton, ProjectDetailSkeleton } from '../components/Skeleton'

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-48" />)
    expect(container.firstChild).toHaveClass('h-8 w-48')
  })
})

describe('ProjectDetailSkeleton', () => {
  it('renders multiple skeleton elements', () => {
    const { container } = render(<ProjectDetailSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(5)
  })
})
