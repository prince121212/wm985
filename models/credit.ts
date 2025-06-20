import { Credit } from "@/types/credit";
import { getSupabaseClient, withRequestDeduplication } from "@/models/db";

export async function insertCredit(credit: Credit) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("credits").insert(credit);

  if (error) {
    throw error;
  }

  return data;
}

export async function findCreditByTransNo(
  trans_no: string
): Promise<Credit | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("credits")
    .select("*")
    .eq("trans_no", trans_no)
    .limit(1)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

export async function findCreditByOrderNo(
  order_no: string
): Promise<Credit | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("credits")
    .select("*")
    .eq("order_no", order_no)
    .limit(1)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

export async function getUserValidCredits(
  user_uuid: string
): Promise<Credit[] | undefined> {
  // 使用请求去重，避免同时查询相同用户的积分
  return withRequestDeduplication(`getUserCredits:${user_uuid}`, async () => {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[getUserValidCredits] 开始查询用户积分 (尝试 ${attempt}/${maxRetries}), UUID:`, user_uuid);

      const now = new Date().toISOString();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("credits")
        .select("*")
        .eq("user_uuid", user_uuid)
        .gte("expired_at", now)
        .order("expired_at", { ascending: true });

      if (error) {
        console.error(`[getUserValidCredits] 数据库查询错误 (尝试 ${attempt}):`, {
          code: error.code,
          message: error.message,
          user_uuid
        });

        // 如果是网络错误或超时错误且还有重试机会，继续重试
        const isRetryableError = error.message.includes('fetch failed') ||
                                error.message.includes('network') ||
                                error.message.includes('TimeoutError') ||
                                error.message.includes('timeout');

        if (attempt < maxRetries && isRetryableError) {
          lastError = error;
          const retryDelay = attempt === 1 ? 500 : 1000;
          console.log(`[getUserValidCredits] 网络/超时错误，${retryDelay}ms 后重试...`);

          // 在第二次重试时重置连接
          if (attempt === 2) {
            console.log(`[getUserValidCredits] 重置数据库连接`);
            const { resetSupabaseClient } = require('./db');
            resetSupabaseClient();
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        return undefined;
      }

      console.log(`[getUserValidCredits] 查询成功 (尝试 ${attempt}), 积分记录数:`, data?.length || 0);
      return data;
    } catch (e) {
      console.error(`[getUserValidCredits] 查询异常 (尝试 ${attempt}):`, e, "UUID:", user_uuid);
      lastError = e;

      // 如果还有重试机会，继续重试
      if (attempt < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
        console.log(`[getUserValidCredits] 异常错误，${retryDelay}ms 后重试...`);

        // 在第二次重试时重置连接
        if (attempt === 2) {
          console.log(`[getUserValidCredits] 重置数据库连接`);
          const { resetSupabaseClient } = require('./db');
          resetSupabaseClient();
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

    console.error(`[getUserValidCredits] 所有重试都失败了, UUID: ${user_uuid}, 最后错误:`, lastError);
    return undefined;
  });
}

export async function getCreditsByUserUuid(
  user_uuid: string,
  page: number = 1,
  limit: number = 50
): Promise<Credit[] | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("credits")
    .select("*")
    .eq("user_uuid", user_uuid)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return undefined;
  }

  return data;
}
