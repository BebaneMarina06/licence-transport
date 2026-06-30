import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { LicenseType } from '../types'

const licenseTypesQueryOptions = {
  staleTime: 0,
  refetchOnMount: true as const,
  refetchOnWindowFocus: true as const,
}

export function useLicenseTypes(lang?: string) {
  const path = lang
    ? `/api/v1/license-types?lang=${lang}`
    : '/api/v1/license-types'

  return useQuery({
    queryKey: lang ? queryKeys.licenseTypes(lang) : queryKeys.licenseTypesRoot,
    queryFn: () => api.get<LicenseType[]>(path),
    ...licenseTypesQueryOptions,
    retry: 2,
  })
}
