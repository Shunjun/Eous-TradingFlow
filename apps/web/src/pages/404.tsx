import { Card, CardContent, CardHeader, CardTitle, Button } from '@eous/ui'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t('notFound.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground font-mono">{t('notFound.description')}</p>
          <Button
            variant="accent-outline"
            className="w-full"
            onClick={() => navigate('/', { replace: true })}
          >
            {t('notFound.back')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
