import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getBatchLogsByUser, getBatchLogsCount } from "@/models/batch-log";
import { redisBatchManager } from "@/lib/redis-batch-manager";

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

    // 获取Redis中的活跃任务
    const activeTasks = await redisBatchManager.getUserActiveTasks(user_uuid);

    // 获取数据库中的历史任务
    const [historicalLogs, total] = await Promise.all([
      getBatchLogsByUser(user_uuid, { type, status, offset, limit }),
      getBatchLogsCount(user_uuid, { type, status })
    ]);

    // 合并活跃任务和历史任务，避免重复
    const activeTaskUuids = new Set(activeTasks.map(task => task.uuid));

    const allLogs = [
      // Redis中的活跃任务
      ...activeTasks.map(task => ({
        uuid: task.uuid,
        user_id: task.user_id,
        type: 'batch_upload',
        title: task.title,
        status: task.status,
        total_count: task.total_resources,
        success_count: task.success_count,
        failed_count: task.failed_count,
        details: {
          redis_managed: true,
          total_batches: task.total_batches,
          completed_batches: task.completed_batches
        },
        created_at: task.created_at,
        updated_at: task.updated_at,
        source: 'redis',
        is_active: true
      })),
      // 数据库中的历史任务（排除已在Redis中的活跃任务）
      ...historicalLogs
        .filter(log => !activeTaskUuids.has(log.uuid))
        .map(log => ({
          ...log,
          source: 'database',
          is_active: false
        }))
    ].sort((a, b) => {
      // 确保时间字段存在且有效
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;

      // 如果时间相同，活跃任务优先
      if (timeA === timeB) {
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return 0;
      }

      // 按时间倒序排列（最新的在前面）
      return timeB - timeA;
    });

    // 计算分页信息
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return respData({
      logs: allLogs,
      active_count: activeTasks.length,
      historical_count: historicalLogs.length,
      pagination: {
        page,
        limit,
        total: total + activeTasks.length, // 包含活跃任务的总数
        totalPages,
        hasNext,
        hasPrev
      }
    });

  } catch (error) {
    log.error("查询批量处理日志失败", error as Error);
    return respErr("查询批量处理日志失败，请稍后再试");
  }
}
