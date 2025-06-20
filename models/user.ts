import { User } from "@/types/user";
import { getIsoTimestr } from "@/lib/time";
import { getSupabaseClient, resetSupabaseClient, withRequestDeduplication, isRetryableError } from "./db";
import { log } from "@/lib/logger";

export async function insertUser(user: User) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("users").insert(user);

  if (error) {
    throw error;
  }

  return data;
}

export async function findUserByEmail(
  email: string
): Promise<User | undefined> {
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    log.error("Invalid email format", undefined, { email });
    return undefined;
  }

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`开始查询用户 (尝试 ${attempt}/${maxRetries})`, { email, function: 'findUserByEmail' });

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .limit(1)
        .single();

      if (error) {
        // PGRST116 是 "not found" 错误，这是正常的，不需要重试
        if (error.code === 'PGRST116') {
          console.log(`[findUserByEmail] 用户不存在 (尝试 ${attempt}), Email:`, email);
          return undefined;
        }

        console.error(`[findUserByEmail] 数据库查询错误 (尝试 ${attempt}):`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          email
        });

        // 如果是网络错误或超时错误且还有重试机会，继续重试
        const isRetryableError = error.message.includes('fetch failed') ||
                                error.message.includes('network') ||
                                error.message.includes('TimeoutError') ||
                                error.message.includes('timeout');

        if (attempt < maxRetries && isRetryableError) {
          lastError = error;
          const retryDelay = attempt === 1 ? 500 : 1000;
          console.log(`[findUserByEmail] 网络/超时错误，${retryDelay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // 其他错误直接返回 undefined
        return undefined;
      }

      console.log(`[findUserByEmail] 查询成功 (尝试 ${attempt}), 找到用户:`, !!data);
      return data;
    } catch (e) {
      console.error(`[findUserByEmail] 查询异常 (尝试 ${attempt}):`, e, "Email:", email);
      lastError = e;

      // 如果还有重试机会，继续重试
      if (attempt < maxRetries) {
        const retryDelay = attempt === 1 ? 500 : 1000;
        console.log(`[findUserByEmail] 异常错误，${retryDelay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

  console.error(`[findUserByEmail] 所有重试都失败了, Email: ${email}, 最后错误:`, lastError);
  return undefined;
}

export async function findUserByUuid(uuid: string): Promise<User | undefined> {
  // 使用请求去重，避免同时查询相同用户
  return withRequestDeduplication(`findUser:${uuid}`, async () => {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[findUserByUuid] 开始查询用户 (尝试 ${attempt}/${maxRetries}), UUID:`, uuid);

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("uuid", uuid)
        .single();

      if (error) {
        console.error(`[findUserByUuid] 数据库查询错误 (尝试 ${attempt}):`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          uuid
        });

        // 如果是网络错误或超时错误且还有重试机会，继续重试
        if (attempt < maxRetries && isRetryableError(error)) {
          lastError = error;
          // 使用渐进的重试间隔：500ms, 1000ms
          const retryDelay = attempt === 1 ? 500 : 1000;
          console.log(`[findUserByUuid] 网络/超时错误，${retryDelay}ms 后重试...`);

          // 在第二次重试时重置连接（更保守的策略）
          if (attempt === 2) {
            console.log(`[findUserByUuid] 重置数据库连接`);
            resetSupabaseClient();
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        return undefined;
      }

      console.log(`[findUserByUuid] 查询成功 (尝试 ${attempt}), 找到用户:`, !!data);
      return data;
    } catch (e) {
      console.error(`[findUserByUuid] 查询异常 (尝试 ${attempt}):`, e, "UUID:", uuid);
      lastError = e;

      // 如果还有重试机会，继续重试
      if (attempt < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
        console.log(`[findUserByUuid] 异常错误，${retryDelay}ms 后重试...`);

        // 在第二次重试时重置连接
        if (attempt === 2) {
          console.log(`[findUserByUuid] 重置数据库连接`);
          resetSupabaseClient();
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

    console.error(`[findUserByUuid] 所有重试都失败了, UUID: ${uuid}, 最后错误:`, lastError);
    return undefined;
  });
}

export async function getUsers(
  page: number = 1,
  limit: number = 50
): Promise<User[] | undefined> {
  if (page < 1) page = 1;
  if (limit <= 0) limit = 50;

  const offset = (page - 1) * limit;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return undefined;
  }

  return data;
}

export async function updateUserInviteCode(
  user_uuid: string,
  invite_code: string
) {
  const supabase = getSupabaseClient();
  const updated_at = getIsoTimestr();
  const { data, error } = await supabase
    .from("users")
    .update({ invite_code, updated_at })
    .eq("uuid", user_uuid);

  if (error) {
    throw error;
  }

  return data;
}

export async function updateUserInvitedBy(
  user_uuid: string,
  invited_by: string
) {
  const supabase = getSupabaseClient();
  const updated_at = getIsoTimestr();
  const { data, error } = await supabase
    .from("users")
    .update({ invited_by, updated_at })
    .eq("uuid", user_uuid);

  if (error) {
    throw error;
  }

  return data;
}

export async function getUsersByUuids(user_uuids: string[]): Promise<User[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .in("uuid", user_uuids);
  if (error) {
    return [];
  }

  return data as User[];
}

export async function findUserByInviteCode(invite_code: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("invite_code", invite_code)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

export async function getUserUuidsByEmail(email: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("uuid")
    .eq("email", email);
  if (error) {
    return [];
  }

  return data.map((user) => user.uuid);
}

/**
 * 创建邮箱注册用户
 */
export async function createEmailUser(user: User & { password_hash: string }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("users").insert({
    ...user,
    signin_type: 'email',
    signin_provider: 'email',
    // 保持传入的 email_verified 状态，不强制覆盖
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 验证用户邮箱
 */
export async function verifyUserEmail(email: string) {
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  const supabase = getSupabaseClient();
  const updated_at = getIsoTimestr();
  const { data, error } = await supabase
    .from("users")
    .update({
      email_verified: true,
      email_verified_at: updated_at,
      updated_at,
    })
    .eq("email", email.toLowerCase().trim())
    .eq("signin_provider", "email");

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 根据邮箱查找邮箱注册用户
 */
export async function findEmailUser(email: string): Promise<User | undefined> {
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Invalid email format:", email);
    return undefined;
  }

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[findEmailUser] 开始查询邮箱用户 (尝试 ${attempt}/${maxRetries}), Email:`, email);

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .eq("signin_provider", "email")
        .limit(1)
        .single();

      if (error) {
        // PGRST116 是 "not found" 错误，这是正常的，不需要重试
        if (error.code === 'PGRST116') {
          console.log(`[findEmailUser] 用户不存在 (尝试 ${attempt}), Email:`, email);
          return undefined;
        }

        console.error(`[findEmailUser] 数据库查询错误 (尝试 ${attempt}):`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          email
        });

        // 如果是网络错误或超时错误且还有重试机会，继续重试
        const isRetryableError = error.message.includes('fetch failed') ||
                                error.message.includes('network') ||
                                error.message.includes('TimeoutError') ||
                                error.message.includes('timeout');

        if (attempt < maxRetries && isRetryableError) {
          lastError = error;
          // 使用指数退避：2s, 4s
          const retryDelay = Math.pow(2, attempt) * 1000;
          console.log(`[findEmailUser] 网络/超时错误，${retryDelay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // 其他错误直接返回 undefined
        return undefined;
      }

      console.log(`[findEmailUser] 查询成功 (尝试 ${attempt}), 找到用户:`, !!data);
      return data;
    } catch (e) {
      console.error(`[findEmailUser] 查询异常 (尝试 ${attempt}):`, e, "Email:", email);
      lastError = e;

      // 如果还有重试机会，继续重试
      if (attempt < maxRetries) {
        const retryDelay = Math.pow(2, attempt) * 1000;
        console.log(`[findEmailUser] 异常错误，${retryDelay}ms 后重试...`);

        // 如果是第二次重试，重置数据库连接
        if (attempt === 2) {
          console.log("[findEmailUser] 重置数据库连接");
          resetSupabaseClient();
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

  console.error(`[findEmailUser] 所有重试都失败了, Email: ${email}, 最后错误:`, lastError);
  console.error(`[findEmailUser] 建议检查：
    1. Supabase 数据库连接状态
    2. 网络连接稳定性
    3. 数据库连接池配置
    4. 是否需要升级 Supabase 计划`);
  return undefined;
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(email: string, password_hash: string) {
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  // 验证密码哈希不为空
  if (!password_hash || password_hash.trim().length === 0) {
    throw new Error("Password hash cannot be empty");
  }

  const supabase = getSupabaseClient();
  const updated_at = getIsoTimestr();
  const { data, error } = await supabase
    .from("users")
    .update({
      password_hash,
      updated_at,
    })
    .eq("email", email.toLowerCase().trim())
    .eq("signin_provider", "email");

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 更新用户个人资料
 */
export async function updateUserProfile(
  user_uuid: string,
  profile: { nickname?: string; avatar_url?: string }
) {
  if (!user_uuid) {
    throw new Error("User UUID is required");
  }

  // 验证用户名
  if (profile.nickname !== undefined) {
    if (!profile.nickname || profile.nickname.trim().length === 0) {
      throw new Error("Nickname cannot be empty");
    }
    if (profile.nickname.trim().length > 50) {
      throw new Error("Nickname cannot exceed 50 characters");
    }
  }

  const supabase = getSupabaseClient();
  const updated_at = getIsoTimestr();
  const updateData: any = { updated_at };

  if (profile.nickname !== undefined) {
    updateData.nickname = profile.nickname.trim();
  }
  if (profile.avatar_url !== undefined) {
    updateData.avatar_url = profile.avatar_url;
  }

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("uuid", user_uuid);

  if (error) {
    throw error;
  }

  return data;
}
