import { getSupabaseClient, withRetry } from "./db";
import { log } from "@/lib/logger";

export interface BatchLog {
  id?: number;
  uuid: string;
  user_id: string;
  type: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_count: number;
  success_count: number;
  failed_count: number;
  details?: any;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

export interface BatchLogDetail {
  name: string;
  success: boolean;
  uuid?: string;
  error?: string;
}

// 创建批量处理日志
export async function createBatchLog(batchLog: Omit<BatchLog, 'id' | 'created_at' | 'updated_at'>): Promise<BatchLog> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from("batch_logs")
      .insert({
        ...batchLog,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      log.error("创建批量处理日志失败", error, { batchLog });
      throw error;
    }

    log.info("批量处理日志创建成功", { uuid: data.uuid, type: data.type });
    return data;
  });
}

// 更新批量处理日志
export async function updateBatchLog(
  uuid: string, 
  updates: Partial<Pick<BatchLog, 'status' | 'success_count' | 'failed_count' | 'details' | 'error_message' | 'completed_at'>>
): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from("batch_logs")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("uuid", uuid);

    if (error) {
      log.error("更新批量处理日志失败", error, { uuid, updates });
      throw error;
    }

    log.info("批量处理日志更新成功", { uuid, status: updates.status });
  });
}

// 根据UUID查询批量处理日志
export async function findBatchLogByUuid(uuid: string): Promise<BatchLog | null> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from("batch_logs")
      .select("*")
      .eq("uuid", uuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 记录不存在
      }
      log.error("查询批量处理日志失败", error, { uuid });
      throw error;
    }

    return data;
  });
}

// 查询用户的批量处理日志列表
export async function getBatchLogsByUser(
  userId: string,
  params: {
    type?: string;
    status?: string;
    offset?: number;
    limit?: number;
  } = {}
): Promise<BatchLog[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from("batch_logs")
      .select("*")
      .eq("user_id", userId);

    // 添加筛选条件
    if (params.type) {
      query = query.eq("type", params.type);
    }
    if (params.status) {
      query = query.eq("status", params.status);
    }

    // 分页和排序
    query = query
      .order("created_at", { ascending: false })
      .range(params.offset || 0, (params.offset || 0) + (params.limit || 20) - 1);

    const { data, error } = await query;

    if (error) {
      log.error("查询用户批量处理日志失败", error, { userId, params });
      throw error;
    }

    return data || [];
  });
}

// 获取批量处理日志总数
export async function getBatchLogsCount(
  userId: string,
  params: {
    type?: string;
    status?: string;
  } = {}
): Promise<number> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from("batch_logs")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);

    // 添加筛选条件
    if (params.type) {
      query = query.eq("type", params.type);
    }
    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { count, error } = await query;

    if (error) {
      log.error("查询批量处理日志总数失败", error, { userId, params });
      throw error;
    }

    return count || 0;
  });
}

// 删除批量处理日志
export async function deleteBatchLog(uuid: string): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from("batch_logs")
      .delete()
      .eq("uuid", uuid);

    if (error) {
      log.error("删除批量处理日志失败", error, { uuid });
      throw error;
    }

    log.info("批量处理日志删除成功", { uuid });
  });
}

// 清理过期的批量处理日志（可选，用于定期清理）
export async function cleanupExpiredBatchLogs(daysOld: number = 30): Promise<number> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from("batch_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("uuid");

    if (error) {
      log.error("清理过期批量处理日志失败", error, { daysOld });
      throw error;
    }

    const deletedCount = data?.length || 0;
    log.info("清理过期批量处理日志完成", { deletedCount, daysOld });
    
    return deletedCount;
  });
}
