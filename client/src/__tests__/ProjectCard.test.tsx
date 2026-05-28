import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectCard from '../components/ProjectCard'
import type { Project } from '../types'

const baseProject: Project = {
  id: 1,
  title: 'مشروع اختبار',
  description: 'وصف المشروع',
  tasks_count: 10,
  subtasks_count: 20,
  completed_count: 5,
  created_at: '2024-01-01',
  status: 'active',
  created_by: 1,
  created_by_name: 'أحمد',
  created_by_avatar: null,
}

describe('ProjectCard', () => {
  it('renders project title', () => {
    render(<ProjectCard project={baseProject} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('مشروع اختبار')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<ProjectCard project={baseProject} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('وصف المشروع')).toBeInTheDocument()
  })

  it('does not render description when absent', () => {
    const project = { ...baseProject, description: null }
    render(<ProjectCard project={project} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.queryByText('وصف المشروع')).not.toBeInTheDocument()
  })

  it('shows task count and subtask count', () => {
    render(<ProjectCard project={baseProject} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('shows progress percentage', () => {
    render(<ProjectCard project={baseProject} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('shows 0% when no tasks', () => {
    const project = { ...baseProject, tasks_count: 0, subtasks_count: 0, completed_count: 0 }
    render(<ProjectCard project={project} selected={false} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('calls onSelect on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ProjectCard project={baseProject} selected={false} onSelect={onSelect} onSettings={vi.fn()} index={0} />)
    await user.click(screen.getByText('مشروع اختبار'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('calls onSettings on settings button click', async () => {
    const onSettings = vi.fn()
    const user = userEvent.setup()
    render(<ProjectCard project={baseProject} selected={false} onSelect={vi.fn()} onSettings={onSettings} index={0} />)
    await user.click(screen.getByTitle('إعدادات'))
    expect(onSettings).toHaveBeenCalledOnce()
  })

  it('shows selected border when selected', () => {
    const { container } = render(<ProjectCard project={baseProject} selected={true} onSelect={vi.fn()} onSettings={vi.fn()} index={0} />)
    expect(container.firstChild).toHaveStyle({ border: '2px solid #4A90D9' })
  })
})
