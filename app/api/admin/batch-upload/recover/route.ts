import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { redisBatchManager } from "@/lib/redis-batch-manager";

// POST /api/admin/batch-upload/recover - 手动恢复中断的批量上传任务
export async function POST(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const { task_uuid } = body;

    // 验证task_uuid格式
    if (task_uuid && !/^[a-zA-Z0-9-_]{20,50}$/.test(task_uuid)) {
      return respErr("无效的任务UUID格式");
    }

    log.info("收到任务恢复请求", {
      user_uuid,
      task_uuid
    });

    if (task_uuid) {
      // 恢复特定任务
      await redisBatchManager.recoverTask(task_uuid);
      
      return respData({
        message: `任务 ${task_uuid} 恢复处理已启动`,
        task_uuid
      });
    } else {
      // 检查并恢复所有中断的任务
      await redisBatchManager.checkAndRecoverStuckTasks();
      
      return respData({
        message: "所有中断任务的恢复检查已完成"
      });
    }

  } catch (error) {
    log.error("任务恢复失败", error as Error);
    return respErr("任务恢复失败，请稍后再试");
  }
}
