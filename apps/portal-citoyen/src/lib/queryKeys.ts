export const queryKeys = {
  licenseTypesRoot: ['license-types'] as const,
  licenseTypes: (lang: string) => ['license-types', lang] as const,
  adminLicenseTypes: ['admin-license-types'] as const,
}
