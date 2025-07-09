import { NextRequest } from "next/server";
import { respErr, respData } from "@/lib/resp";
import { log } from "@/lib/logger";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { getSupabaseClient } from "@/models/db";
import { redisBatchManager } from "@/lib/redis-batch-manager";

export async function DELETE(request: NextRequest) {
  try {
    // 检查用户登录状态
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respErr("用户未登录", 401);
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respErr("权限不足", 403);
    }

    log.info("开始清空批量处理记录", { user_uuid });

    const supabase = getSupabaseClient();

    // 清空数据库中的批量处理日志
    const { error: dbError } = await supabase
      .from('batch_logs')
      .delete()
      .neq('uuid', ''); // 删除所有记录

    if (dbError) {
      log.error("清空数据库批量处理记录失败", dbError, { user_uuid });
      return respErr("清空记录失败");
    }

    // 清空Redis中的批量处理数据
    try {
      await redisBatchManager.clearAllBatchData();
      log.info("Redis批量处理数据清空成功", { user_uuid });
    } catch (redisError) {
      log.warn("清空Redis批量处理数据失败", {
        user_uuid,
        error: redisError instanceof Error ? redisError.message : String(redisError)
      });
      // Redis清空失败不影响整体操作，只记录警告
    }

    log.info("批量处理记录清空成功", { user_uuid });
    return respData({ message: "批量处理记录已清空" });

  } catch (error) {
    log.error("清空批量处理记录时发生错误", error as Error);
    return respErr("清空记录失败");
  }
}
