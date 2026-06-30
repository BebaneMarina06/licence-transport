export type UserRole = 'citizen' | 'agent' | 'supervisor' | 'admin' | 'auditor'

export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  national_id: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'complement_requested'
  | 'approved'
  | 'awaiting_payment'
  | 'paid'
  | 'delivered'
  | 'rejected'
  | 'cancelled'

export interface LicenseType {
  id: number
  code: string
  name: string
  description: string | null
  fee_amount: number
  validity_months: number
  required_documents: string | null
  is_active: boolean
}

export interface StatusHistory {
  id: number
  from_status: ApplicationStatus | null
  to_status: ApplicationStatus
  comment: string | null
  created_at: string
}

export type DocumentType = 'carte_grise' | 'visite_technique' | 'assurance'

export interface ApplicationDocument {
  id: number
  document_type: DocumentType
  original_filename: string
  content_type: string
  file_size: number
  uploaded_at: string
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  carte_grise: 'Photocopie carte grise',
  visite_technique: 'Photocopie visite technique',
  assurance: 'Photocopie assurance',
}

export interface IssuedLicense {
  id: number
  license_number: string
  holder_name: string
  company_name: string | null
  vehicle_plate: string | null
  license_type_name: string
  issued_at: string
  expires_at: string
  is_revoked: boolean
}

export interface Application {
  id: number
  reference: string
  status: ApplicationStatus
  company_name: string | null
  vehicle_plate: string | null
  notes: string | null
  rejection_reason: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  license_type: LicenseType
  status_history?: StatusHistory[]
  documents?: ApplicationDocument[]
  issued_license?: IssuedLicense | null
  applicant?: User
}

export interface DashboardStats {
  total_applications: number
  pending_review: number
  awaiting_payment: number
  delivered: number
  rejected: number
  total_citizens: number
  applications_by_status: Record<string, number>
}
