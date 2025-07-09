import { respData, respErr, respNotFound, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { findBatchLogByUuid } from "@/models/batch-log";

// GET /api/admin/batch-upload/logs/[uuid] - 查询特定批量处理日志详情
export async function GET(
  req: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    const { uuid } = params;

    if (!uuid) {
      return respErr("缺少日志UUID参数");
    }

    log.info("查询批量处理日志详情", {
      user_uuid,
      logUuid: uuid
    });

    // 查询日志详情
    const batchLog = await findBatchLogByUuid(uuid);

    if (!batchLog) {
      return respNotFound("批量处理日志不存在");
    }

    // 验证日志所有权（只能查看自己的日志）
    if (batchLog.user_id !== user_uuid) {
      return respUnauthorized("无权限查看此日志");
    }

    return respData({
      log: batchLog
    });

  } catch (error) {
    log.error("查询批量处理日志详情失败", error);
    return respErr("查询批量处理日志详情失败，请稍后再试");
  }
}
