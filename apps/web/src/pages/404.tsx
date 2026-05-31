import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@eous/ui'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Page not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground font-mono">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button
            variant="accent-outline"
            className="w-full"
            onClick={() => navigate('/', { replace: true })}
          >
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
