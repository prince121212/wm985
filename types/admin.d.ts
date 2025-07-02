// 管理后台相关的类型定义

export interface CategoryInput {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  parent_id?: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  details: Array<{
    name: string;
    status: 'success' | 'error';
    message?: string;
  }>;
}
