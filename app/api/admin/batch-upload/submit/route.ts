import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getUuid } from "@/lib/hash";
import { createBatchLog } from "@/models/batch-log";
import { processBatchUpload } from "@/lib/batch-upload-processor";

interface BatchResourceItem {
  name: string;
  link: string;
}

interface BatchUploadRequest {
  total_resources: number;
  resources: BatchResourceItem[];
}

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

    if (resources.length > 500) {
      return respInvalidParams("一次最多只能上传500个资源");
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
        .substring(0, 100);         // 限制长度

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

    // 创建批量处理任务记录
    const taskUuid = getUuid();
    const batchLog = await createBatchLog({
      uuid: taskUuid,
      user_id: user_uuid,
      type: 'batch_upload',
      title: `批量上传资源 - ${resources.length}个资源`,
      status: 'pending',
      total_count: resources.length,
      success_count: 0,
      failed_count: 0,
      details: {
        resources: resources.map((r, index) => ({
          index: index + 1,
          name: r.name,
          link: r.link,
          status: 'pending'
        }))
      }
    });

    // 异步处理批量上传任务（不阻塞响应）
    processBatchUpload(taskUuid, resources, user_uuid).catch(error => {
      log.error("批量上传处理失败", error, { taskUuid, user_uuid });
    });

    log.info("批量上传任务已创建", {
      taskUuid,
      resourceCount: resources.length,
      user_uuid
    });

    return respData({
      task_uuid: taskUuid,
      message: "已收到批量上传资源任务，将在后台处理，处理结果稍后打开本弹窗即可看到处理记录",
      total_count: resources.length,
      status: "pending"
    });

  } catch (error) {
    log.error("批量上传提交失败", error as Error);
    return respErr("批量上传提交失败，请稍后再试");
  }
}
