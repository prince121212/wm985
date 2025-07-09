import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getBatchLogsByUser, getBatchLogsCount } from "@/models/batch-log";

// GET /api/admin/batch-upload/logs - 查询批量处理日志列表
export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    // 解析查询参数
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 验证分页参数
    if (page < 1 || limit < 1 || limit > 100) {
      return respErr("分页参数无效");
    }

    const offset = (page - 1) * limit;

    log.info("查询批量处理日志", {
      user_uuid,
      type,
      status,
      page,
      limit
    });

    // 查询日志列表和总数
    const [logs, total] = await Promise.all([
      getBatchLogsByUser(user_uuid, { type, status, offset, limit }),
      getBatchLogsCount(user_uuid, { type, status })
    ]);

    // 计算分页信息
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return respData({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev
      }
    });

  } catch (error) {
    log.error("查询批量处理日志失败", error);
    return respErr("查询批量处理日志失败，请稍后再试");
  }
}
