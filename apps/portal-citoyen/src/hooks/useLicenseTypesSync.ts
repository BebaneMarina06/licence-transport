import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshLicenseTypeData, subscribeLicenseTypesUpdated } from '../lib/licenseTypeCache'

/** Écoute les mises à jour backoffice (même onglet ou autre onglet) et rafraîchit l'espace citoyen. */
export function useLicenseTypesSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    return subscribeLicenseTypesUpdated(() => {
      void refreshLicenseTypeData(queryClient, { broadcast: false })
    })
  }, [queryClient])
}
