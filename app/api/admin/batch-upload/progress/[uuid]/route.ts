import { respData, respErr, respUnauthorized, respNotFound } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { redisBatchManager } from "@/lib/redis-batch-manager";
import { findBatchLogByUuid } from "@/models/batch-log";

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';

// GET /api/admin/batch-upload/progress/[uuid] - 查询任务进度
export async function GET(
  _req: Request,
  { params }: { params: { uuid: string } }
) {
  const { uuid } = params;

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

    if (!uuid) {
      return respErr("缺少任务UUID参数");
    }

    log.info("查询任务进度", { user_uuid, task_uuid: uuid });

    // 首先尝试从Redis获取实时进度
    const redisProgress = await redisBatchManager.getTaskProgress(uuid);
    
    if (redisProgress) {
      // 任务正在进行中，返回Redis中的实时数据
      const mainTask = await redisBatchManager.getMainTask(uuid);
      
      if (!mainTask) {
        return respErr("任务数据不完整");
      }

      // 验证权限
      if (mainTask.user_id !== user_uuid) {
        return respUnauthorized("无权限查看此任务");
      }

      // 获取剩余子任务数量
      const remainingSubtasks = await redisBatchManager.getRemainingSubtaskCount(uuid);
      
      return respData({
        source: 'redis',
        is_active: true,
        task_info: {
          uuid: mainTask.uuid,
          title: mainTask.title,
          status: redisProgress.status,
          created_at: mainTask.created_at,
          updated_at: mainTask.updated_at
        },
        progress: {
          total_batches: redisProgress.total_batches,
          completed_batches: redisProgress.completed_batches,
          remaining_batches: redisProgress.total_batches - redisProgress.completed_batches,
          success_count: redisProgress.success_count,
          failed_count: redisProgress.failed_count,
          total_resources: mainTask.total_resources,
          progress_percentage: redisProgress.progress_percentage,
          last_updated: redisProgress.last_updated
        },
        queue_info: {
          remaining_subtasks: remainingSubtasks,
          is_processing: redisProgress.status === 'processing'
        }
      });
    } else {
      // Redis中没有数据，从数据库获取历史记录
      const batchLog = await findBatchLogByUuid(uuid);
      
      if (!batchLog) {
        return respNotFound("任务不存在");
      }

      // 验证权限
      if (batchLog.user_id !== user_uuid) {
        return respUnauthorized("无权限查看此任务");
      }

      // 计算进度百分比
      const totalProcessed = batchLog.success_count + batchLog.failed_count;
      const progressPercentage = batchLog.total_count > 0 
        ? Math.round((totalProcessed / batchLog.total_count) * 100)
        : 0;

      return respData({
        source: 'database',
        is_active: false,
        task_info: {
          uuid: batchLog.uuid,
          title: batchLog.title,
          status: batchLog.status,
          created_at: batchLog.created_at,
          updated_at: batchLog.updated_at,
          completed_at: batchLog.completed_at
        },
        progress: {
          total_count: batchLog.total_count,
          success_count: batchLog.success_count,
          failed_count: batchLog.failed_count,
          progress_percentage: progressPercentage,
          last_updated: batchLog.updated_at
        },
        details: batchLog.details
      });
    }

  } catch (error) {
    log.error("查询任务进度失败", error as Error, { task_uuid: uuid });
    return respErr("查询失败，请稍后再试");
  }
}
