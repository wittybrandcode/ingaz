import KanbanBoard from '../components/KanbanBoard'
import ErrorBoundary from '../components/ErrorBoundary'

export default function Projects() {
  return <ErrorBoundary><KanbanBoard /></ErrorBoundary>
}
