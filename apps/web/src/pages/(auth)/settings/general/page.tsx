import {
  CardPanel,
  CardPanelHeader,
  CardPanelBody,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eous/ui'
import { Languages, Sliders } from 'lucide-react'
import { locales, type Locale } from '@eous/i18n'
import { useI18n, useLanguageSwitcher } from '../../../../lib/i18n'

export default function GeneralSettingsPage() {
  const { t, localeLabels } = useI18n()
  const { locale, setLocale } = useLanguageSwitcher()

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={Sliders} title={t('settings.generalTitle')} />
        <CardPanelBody className="p-6 space-y-6">
          <section className="flex flex-col gap-4 rounded-md border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Languages size={16} className="text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">
                  {t('settings.languageTitle')}
                </h2>
                <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                  {t('settings.languageDescription')}
                </p>
              </div>
            </div>

            <div className="min-w-48 space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                {t('settings.languageLabel')}
              </Label>
              <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((item) => (
                    <SelectItem key={item} value={item}>
                      {localeLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
