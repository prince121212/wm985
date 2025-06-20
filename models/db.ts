import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 全局客户端实例，避免重复创建
let supabaseClient: SupabaseClient | null = null;
let connectionAttempts = 0;
let lastConnectionTime = 0;

// 请求去重缓存
const requestCache = new Map<string, Promise<any>>();
const cacheTimeout = 5000; // 5秒缓存

export function getSupabaseClient() {
  // 如果已有客户端实例，直接返回
  if (supabaseClient) {
    return supabaseClient;
  }

  connectionAttempts++;
  lastConnectionTime = Date.now();
  console.log(`[getSupabaseClient] 创建新的数据库连接 (第${connectionAttempts}次)`);

  const supabaseUrl = process.env.SUPABASE_URL || "";

  let supabaseKey = process.env.SUPABASE_ANON_KEY || "";
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL or key is not set");
  }

  // 创建客户端实例 - 使用最简单的配置确保稳定性
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, // API 路由中不需要持久化会话
    },
    db: {
      schema: 'public',
    },
  });

  // 轻量级预热连接
  if (process.env.NODE_ENV === 'development' && supabaseClient) {
    setTimeout(async () => {
      try {
        console.log("[getSupabaseClient] 预热数据库连接...");
        // 使用最简单的查询进行预热
        await supabaseClient!
          .from('users')
          .select('uuid')
          .limit(1);
        console.log("[getSupabaseClient] 连接预热完成");
      } catch (error) {
        console.log("[getSupabaseClient] 连接预热失败，但不影响正常使用");
      }
    }, 2000); // 延迟2秒，给应用更多启动时间
  }

  return supabaseClient;
}

/**
 * 重置数据库连接（在连接问题时使用）
 */
export function resetSupabaseClient() {
  console.log("[resetSupabaseClient] 重置数据库连接");
  supabaseClient = null;
  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
  }
  return getSupabaseClient();
}

/**
 * 请求去重包装器
 */
export function withRequestDeduplication<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // 检查是否有正在进行的相同请求
  if (requestCache.has(key)) {
    console.log(`[withRequestDeduplication] 复用进行中的请求: ${key}`);
    return requestCache.get(key)!;
  }

  // 创建新请求
  const promise = requestFn().finally(() => {
    // 请求完成后，延迟清除缓存
    setTimeout(() => {
      requestCache.delete(key);
    }, cacheTimeout);
  });

  requestCache.set(key, promise);
  return promise;
}

/**
 * 数据库健康检查 - 使用最简单的查询
 */
export async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    const supabase = getSupabaseClient();

    // 使用最简单的查询，只检查连接是否可用
    const { error } = await supabase
      .from('users')
      .select('uuid')
      .limit(1)
      .single();

    const latency = Date.now() - startTime;

    // 对于健康检查，PGRST116 (not found) 也算成功，说明连接正常
    if (error && error.code !== 'PGRST116') {
      return { healthy: false, latency, error: error.message };
    }

    return { healthy: true, latency };
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const message = error.message || '';
  const code = error.code || '';

  // 网络相关错误
  const networkErrors = [
    'fetch failed',
    'network',
    'TimeoutError',
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED'
  ];

  return networkErrors.some(errorType =>
    message.includes(errorType) || code.includes(errorType)
  );
}

/**
 * 获取连接统计信息
 */
export function getConnectionStats() {
  return {
    hasClient: !!supabaseClient,
    connectionAttempts,
    lastConnectionTime: lastConnectionTime ? new Date(lastConnectionTime).toISOString() : null,
    timeSinceLastConnection: lastConnectionTime ? Date.now() - lastConnectionTime : null,
    activeRequests: requestCache.size,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
  };
}


