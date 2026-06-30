import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

const SYNC_CHANNEL = 'dgtt-license-types-updated'

export function broadcastLicenseTypesUpdated() {
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channel.postMessage({ at: Date.now() })
    channel.close()
  } catch {
    /* navigateurs sans BroadcastChannel */
  }
}

export function subscribeLicenseTypesUpdated(onUpdate: () => void) {
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channel.onmessage = () => onUpdate()
    return () => channel.close()
  } catch {
    return () => {}
  }
}

/** Invalide toutes les données citoyen liées aux types de licence. */
export async function refreshLicenseTypeData(
  queryClient: QueryClient,
  options?: { broadcast?: boolean },
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.licenseTypesRoot }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminLicenseTypes }),
    queryClient.invalidateQueries({ queryKey: ['my-applications'] }),
    queryClient.invalidateQueries({ queryKey: ['application'] }),
    queryClient.invalidateQueries({ queryKey: ['payment-quotes'] }),
  ])

  if (options?.broadcast !== false) {
    broadcastLicenseTypesUpdated()
  }
}
