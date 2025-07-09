import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getUuid } from "@/lib/hash";
import { createBatchLog } from "@/models/batch-log";
import { redisBatchManager } from "@/lib/redis-batch-manager";
import { getSupabaseClient } from "@/models/db";
import { BatchUploadRequest, BATCH_UPLOAD_CONFIG } from "@/types/batch-upload";

// POST /api/admin/batch-upload/submit - 提交批量上传任务
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

    const body = await req.json();
    const { total_resources, resources }: BatchUploadRequest = body;

    // 验证输入
    if (!resources || !Array.isArray(resources)) {
      return respInvalidParams("resources参数必须是数组");
    }

    if (resources.length === 0) {
      return respInvalidParams("资源数组不能为空");
    }

    if (resources.length > BATCH_UPLOAD_CONFIG.MAX_RESOURCES_PER_BATCH) {
      return respInvalidParams(`一次最多只能上传${BATCH_UPLOAD_CONFIG.MAX_RESOURCES_PER_BATCH}个资源`);
    }

    // 验证total_resources字段
    if (total_resources && total_resources !== resources.length) {
      log.warn("total_resources与实际资源数量不匹配", {
        total_resources,
        actual_count: resources.length,
        user_uuid
      });
    }

    // 验证每个资源的基本信息并清理数据
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];

      // 清理资源名称
      if (!resource.name?.trim()) {
        return respInvalidParams(`第${i + 1}个资源的名称不能为空`);
      }

      // 清理名称中的特殊字符，防止JSON序列化问题
      resource.name = resource.name
        .replace(/[\r\n\t]/g, ' ')  // 移除换行符和制表符
        .replace(/["\\\b\f]/g, '')  // 移除可能导致JSON问题的字符
        .replace(/\s+/g, ' ')       // 标准化空格
        .trim()
        .substring(0, BATCH_UPLOAD_CONFIG.MAX_RESOURCE_NAME_LENGTH); // 限制长度

      if (!resource.link?.trim()) {
        return respInvalidParams(`第${i + 1}个资源的链接不能为空`);
      }

      // 清理链接
      resource.link = resource.link.trim();

      // 验证链接格式
      try {
        new URL(resource.link);
      } catch {
        return respInvalidParams(`第${i + 1}个资源的链接格式不正确`);
      }
    }

    log.info("收到批量上传任务", {
      count: resources.length,
      user_uuid
    });

    // 验证用户是否存在于数据库中
    const supabase = getSupabaseClient();
    const { data: userExists, error: userError } = await supabase
      .from('users')
      .select('uuid, email')
      .eq('uuid', user_uuid)
      .single();

    log.info("用户验证结果", {
      user_uuid,
      userExists: !!userExists,
      userEmail: userExists?.email,
      userError: userError?.message
    });

    if (!userExists) {
      log.error("用户不存在于数据库中", new Error("User not found in database"), { user_uuid });
      return respErr("用户验证失败，请重新登录");
    }

    // 创建主任务UUID和分批信息
    const mainTaskUuid = getUuid();
    const batchSize = BATCH_UPLOAD_CONFIG.DEFAULT_BATCH_SIZE;
    const batches = splitIntoBatches(resources, batchSize);

    log.info("开始创建Redis管理的批量任务", {
      mainTaskUuid,
      totalResources: resources.length,
      totalBatches: batches.length,
      batchSize
    });

    // 1. 在Redis中创建主任务
    await redisBatchManager.createMainTask({
      uuid: mainTaskUuid,
      user_id: user_uuid,
      title: `批量上传资源 - ${resources.length}个资源`,
      status: 'pending',
      total_resources: resources.length,
      total_batches: batches.length,
      completed_batches: 0,
      success_count: 0,
      failed_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 2. 创建子任务
    const subtasks = batches.map((batch, index) => ({
      uuid: getUuid(),
      parent_task_uuid: mainTaskUuid,
      batch_index: index + 1,
      status: 'pending' as const,
      resources: batch,
      success_count: 0,
      failed_count: 0,
      results: [],
      created_at: new Date().toISOString()
    }));

    await redisBatchManager.createSubtasksAndQueue(mainTaskUuid, subtasks);

    // 3. 在数据库中创建初始记录（用于最终存储）
    await createBatchLog({
      uuid: mainTaskUuid,
      user_id: user_uuid,
      type: 'batch_upload',
      title: `批量上传资源 - ${resources.length}个资源`,
      status: 'pending',
      total_count: resources.length,
      success_count: 0,
      failed_count: 0,
      details: {
        total_batches: batches.length,
        batch_size: batchSize,
        redis_managed: true, // 标记这是Redis管理的任务
        created_with_redis: true
      }
    });

    // 4. 开始处理第一批
    await redisBatchManager.triggerNextSubtask(mainTaskUuid);

    log.info("Redis批量上传任务创建完成", {
      mainTaskUuid,
      totalBatches: batches.length,
      user_uuid
    });

    return respData({
      task_uuid: mainTaskUuid,
      total_batches: batches.length,
      batch_size: batchSize,
      message: "任务已创建，开始处理第一批",
      total_count: resources.length,
      status: "pending"
    });

  } catch (error) {
    log.error("批量上传提交失败", error as Error);
    return respErr("批量上传提交失败，请稍后再试");
  }
}

// 将资源数组分批
function splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}


