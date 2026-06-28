import { Navigate, useParams } from 'react-router-dom'

export default function LegacyWorkflowEditorPage() {
  const { id } = useParams()
  return <Navigate to={id ? `/workflows/${id}/edit` : '/workflows'} replace />
}
