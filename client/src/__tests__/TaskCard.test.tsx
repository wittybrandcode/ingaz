import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskCard from '../components/TaskCard'

const baseTask = {
  id: 1,
  title: 'مهمة اختبار',
  description: 'وصف المهمة',
  subtasks_count: 5,
  approved_count: 3,
  assignees: [{ name: 'أحمد' }, { name: 'سارة' }],
}

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={baseTask} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('مهمة اختبار')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<TaskCard task={baseTask} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('وصف المهمة')).toBeInTheDocument()
  })

  it('does not render description when absent', () => {
    const task = { ...baseTask, description: null }
    render(<TaskCard task={task} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.queryByText('وصف المهمة')).not.toBeInTheDocument()
  })

  it('shows subtask count', () => {
    render(<TaskCard task={baseTask} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows progress percentage', () => {
    render(<TaskCard task={baseTask} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('calls onSelect on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<TaskCard task={baseTask} selected={false} onSelect={onSelect} onSettings={vi.fn()} index={0} />)
    await user.click(screen.getByText('مهمة اختبار'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('calls onSettings on settings button click', async () => {
    const onSettings = vi.fn()
    const user = userEvent.setup()
    render(<TaskCard task={baseTask} selected={false} onSelect={vi.fn()} onSettings={onSettings} index={0} />)
    await user.click(screen.getByTitle('إعدادات'))
    expect(onSettings).toHaveBeenCalledOnce()
  })

  it('shows selected border when selected is true', () => {
    const { container } = render(<TaskCard task={baseTask} selected={true} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(container.firstChild).toHaveStyle({ border: '2px solid #E5A700' })
  })

  it('shows transparent border when not selected', () => {
    const { container } = render(<TaskCard task={baseTask} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(container.firstChild).toHaveStyle('border-width: 2px')
    expect(container.firstChild).toHaveStyle('border-style: solid')
  })
})
