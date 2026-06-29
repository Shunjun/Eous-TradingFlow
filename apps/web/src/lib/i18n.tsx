import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultLocale,
  getText,
  localeLabels,
  isLocale,
  type Locale,
  type TextKey,
} from '@eous/i18n'

const systemSettingsStorageKey = 'eous.system-settings'

interface SystemSettings {
  locale: Locale
}

interface I18nContextValue {
  locale: Locale
  localeLabels: typeof localeLabels
  setLocale: (locale: Locale) => void
  t: (key: TextKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children?: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => readSystemSettings().locale)

  useEffect(() => {
    writeSystemSettings({ locale })
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      localeLabels,
      setLocale,
      t: (key) => getText(locale, key),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}

export function useLanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return { locale, setLocale }
}

function readSystemSettings(): SystemSettings {
  try {
    const raw = window.localStorage.getItem(systemSettingsStorageKey)
    const parsed = raw ? (JSON.parse(raw) as Partial<SystemSettings>) : null
    return {
      locale: isLocale(parsed?.locale) ? parsed.locale : defaultLocale,
    }
  } catch {
    return { locale: defaultLocale }
  }
}

function writeSystemSettings(settings: SystemSettings) {
  window.localStorage.setItem(systemSettingsStorageKey, JSON.stringify(settings))
}
