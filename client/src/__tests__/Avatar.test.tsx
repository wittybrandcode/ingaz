import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Avatar, { AvatarWithName } from '../components/Avatar'

describe('Avatar', () => {
  it('renders image when avatar prop is provided', () => {
    render(<Avatar name="أحمد" avatar="avatar.jpg" />)
    const img = screen.getByAltText('أحمد')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/uploads/avatar.jpg')
  })

  it('renders first letter when no avatar', () => {
    render(<Avatar name="محمد" />)
    expect(screen.getByText('م')).toBeInTheDocument()
  })

  it('renders first letter of Arabic name', () => {
    render(<Avatar name="سارة" />)
    expect(screen.getByText('س')).toBeInTheDocument()
  })

  it('applies size classes correctly', () => {
    const { rerender } = render(<Avatar name="test" size="xs" />)
    expect(screen.getByText('t').className).toContain('w-5')
    rerender(<Avatar name="test" size="lg" />)
    expect(screen.getByText('t').className).toContain('w-10')
  })

  it('applies custom className', () => {
    render(<Avatar name="test" className="custom-class" />)
    expect(screen.getByText('t').className).toContain('custom-class')
  })

  it('renders img with alt text from name', () => {
    render(<Avatar name="Khaled" avatar="/pic.jpg" />)
    expect(screen.getByAltText('Khaled')).toBeInTheDocument()
  })
})

describe('AvatarWithName', () => {
  it('renders Avatar and name', () => {
    render(<AvatarWithName name="أحمد" />)
    expect(screen.getByText('أ')).toBeInTheDocument()
    expect(screen.getByText('أحمد')).toBeInTheDocument()
  })

  it('hides name when showName is false', () => {
    render(<AvatarWithName name="أحمد" showName={false} />)
    expect(screen.queryByText('أحمد')).not.toBeInTheDocument()
  })
})
