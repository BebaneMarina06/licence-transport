import type { AppLanguage } from '../types'

const LANG_KEY = 'app_lang'

export function getLanguage(): AppLanguage {
  const stored = localStorage.getItem(LANG_KEY)
  return stored === 'en' ? 'en' : 'fr'
}

export function setLanguage(lang: AppLanguage) {
  localStorage.setItem(LANG_KEY, lang)
  window.dispatchEvent(new CustomEvent('app-lang-change', { detail: lang }))
}

export function localizedLicenseName(
  lt: { name: string; name_en?: string | null },
  lang: AppLanguage = getLanguage(),
) {
  return lang === 'en' && lt.name_en ? lt.name_en : lt.name
}
