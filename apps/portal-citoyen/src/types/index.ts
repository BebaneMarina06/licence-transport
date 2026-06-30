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
  profile_complete?: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export type DocumentType = 'carte_grise' | 'visite_technique' | 'assurance'

export interface ApplicationDocument {
  id: number
  document_type: DocumentType
  original_filename: string
  content_type: string
  file_size: number
  uploaded_at: string
  ocr_fields?: Record<string, string> | null
}

export interface DocumentUploadResult {
  document: ApplicationDocument
  ocr_enabled: boolean
  ocr_applied: string[]
  ocr_fields: Record<string, string>
  ocr_message?: string | null
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  carte_grise: 'Photocopie carte grise',
  visite_technique: 'Photocopie visite technique',
  assurance: 'Photocopie assurance',
}

export const REQUIRED_DOCUMENTS: DocumentType[] = [
  'carte_grise',
  'visite_technique',
  'assurance',
]

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

export type DeliveryFormat = 'digital' | 'physical'

export interface LicenseType {
  id: number
  code: string
  name: string
  name_en?: string | null
  description: string | null
  description_en?: string | null
  fee_amount: number
  physical_surcharge: number
  validity_months: number
  required_documents: string | null
  is_active: boolean
}

export interface StatusHistory {
  id: number
  from_status: ApplicationStatus | null
  to_status: ApplicationStatus
  comment: string | null
  changed_by_name?: string | null
  created_at: string
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
  delivery_format: DeliveryFormat | null
  amount_paid: number | null
  paid_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  license_type: LicenseType
  status_history?: StatusHistory[]
  documents?: ApplicationDocument[]
  issued_license?: IssuedLicense | null
  applicant?: User
  assigned_agent?: User | null
}

export interface ApplicationListItem extends Application {
  assigned_agent?: User | null
}

export interface DashboardStats {
  total_applications: number
  pending_review: number
  awaiting_payment: number
  delivered: number
  rejected: number
  total_citizens: number
  total_revenue: number
  revenue_this_month: number
  avg_processing_days: number | null
  overdue_count: number
  applications_by_status: Record<string, number>
  applications_by_license_type: Record<string, number>
}

export interface AuditLogEntry {
  id: number
  user_id: number | null
  user_name: string | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: string | null
  created_at: string
}

export interface StaffUser {
  id: number
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface CitizenUser {
  id: number
  email: string
  full_name: string
  phone: string | null
  national_id: string | null
  is_active: boolean
  created_at: string
  applications_count: number
}

export interface RevenueByLicenseType {
  license_type_name: string
  count: number
  total_amount: number
}

export interface RevenueByMonth {
  month: string
  count: number
  total_amount: number
}

export interface RevenueSummary {
  total_confirmed: number
  confirmed_this_month: number
  pending_validation_amount: number
  pending_validation_count: number
  awaiting_payment_count: number
  confirmed_count: number
  by_license_type: RevenueByLicenseType[]
  by_month: RevenueByMonth[]
}

export interface RevenueEntry {
  application_id: number
  reference: string
  applicant_name: string
  license_type_name: string
  amount: number
  delivery_format: string | null
  status: ApplicationStatus
  paid_at: string | null
  payment_reference: string | null
  revenue_state: 'confirmed' | 'pending_validation' | 'other'
}

export interface PlatformLabel {
  id: number
  key: string
  category: string
  label_fr: string
  label_en: string
  description: string | null
  updated_at: string
}

export type AppLanguage = 'fr' | 'en'

export interface Notification {
  id: number
  application_id: number | null
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

export interface PaymentQuote {
  delivery_format: DeliveryFormat
  base_fee: number
  physical_surcharge: number
  total_amount: number
}

export interface PaymentResult {
  application_id: number
  reference: string
  delivery_format: DeliveryFormat
  amount_paid: number | null
  status: ApplicationStatus
  payment_reference: string
  payment_status: 'pending' | 'completed' | 'failed'
  billing_id: string
  bamboo_ref: string | null
  message: string
}

export interface PaymentStatusResult {
  billing_id: string
  payment_status: 'pending' | 'completed' | 'failed'
  bamboo_ref: string | null
  application_status: ApplicationStatus
  message: string
}

export interface CitizenLicense extends IssuedLicense {
  application_id: number
  application_reference: string
  delivery_format: DeliveryFormat | null
}
