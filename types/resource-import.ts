export interface ResourceImportSource {
  name?: string;
  url?: string;
  description?: string;
}

export interface ResourceImportDefaults {
  author_uuid?: string;
  category_id?: number;
  category_name?: string;
  tags?: string[];
  is_free?: boolean;
  credits?: number;
  safety_score?: number;
}

export interface ResourceImportOptions {
  safe_threshold?: number;
  create_missing_categories?: boolean;
  skip_existing?: boolean;
}

export interface ResourceImportItem {
  external_id?: string;
  title?: string;
  name?: string;
  url?: string;
  link?: string;
  description?: string;
  content?: string;
  category_id?: number;
  category_name?: string;
  tags?: string[];
  source_section?: string;
  quality?: string;
  safety_score?: number;
  safety_note?: string;
  is_free?: boolean;
  credits?: number;
}

export interface ResourceImportRequest {
  source?: ResourceImportSource;
  defaults?: ResourceImportDefaults;
  options?: ResourceImportOptions;
  resources: ResourceImportItem[];
}

export interface NormalizedImportResource {
  index: number;
  external_id?: string;
  title: string;
  url: string;
  description: string;
  content: string;
  category_id?: number;
  category_name: string;
  tags: string[];
  source_section?: string;
  quality?: string;
  safety_score: number;
  safety_note?: string;
  is_free: boolean;
  credits: number;
  status: 'approved' | 'pending';
  ai_risk_score: number;
  auto_approved: boolean;
  errors: string[];
  duplicate_in_payload: boolean;
  existing_duplicate?: {
    uuid: string;
    title: string;
    status: string;
  };
  category?: {
    id?: number;
    name: string;
    exists: boolean;
    will_create: boolean;
  };
}

export interface ResourceImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate_in_payload: number;
  existing_duplicates: number;
  will_import: number;
  will_approve: number;
  will_pending: number;
  categories_to_create: string[];
}
