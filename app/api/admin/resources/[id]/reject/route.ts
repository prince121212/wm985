import { respData, respErr, respInvalidParams, respUnauthorized, respNotFound } from "@/lib/resp";
import { getUserUuid, isUserAdmin, getUserEmail } from "@/services/user";
import { log } from "@/lib/logger";
import { findResourceByUuid, updateResource } from "@/models/resource";
import { getSupabaseClient, withRetry } from "@/models/db";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/admin/resources/[id]/reject - 拒绝资源
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user_uuid = await getUserUuid();
    const user_email = await getUserEmail();

    if (!user_uuid || !user_email) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    const { id } = await params;
    if (!id) {
      return respInvalidParams("资源ID不能为空");
    }

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    log.info("管理员拒绝资源", { resourceId: id, user_uuid, action: "reject", reason });

    // 检查资源是否存在
    const resource = await findResourceByUuid(id);
    if (!resource) {
      return respNotFound("资源不存在");
    }

    const oldStatus = resource.status;

    // 检查资源状态
    if (resource.status === 'rejected') {
      return respData({
        message: "资源已经是拒绝状态",
        resource: {
          uuid: resource.uuid,
          title: resource.title,
          status: resource.status
        }
      });
    }

    // 更新资源状态为已拒绝
    const updateData: any = {
      status: 'rejected',
      updated_at: new Date().toISOString()
    };

    // 如果提供了拒绝原因，可以保存到content字段或者单独的字段
    if (reason) {
      updateData.rejection_reason = reason;
    }

    await updateResource(id, updateData);

    // 如果资源状态从approved变为rejected，更新用户的总通过审核资源数
    if (oldStatus === 'approved') {
      await updateUserApprovedResourcesCount(resource.author_id);
    }

    // 审核日志功能已移除

    log.info("资源已拒绝", {
      resourceId: id,
      title: resource.title,
      user_uuid,
      reason,
      authorId: resource.author_id,
      oldStatus
    });

    return respData({
      message: "资源已拒绝",
      resource: {
        uuid: resource.uuid,
        title: resource.title,
        status: 'rejected'
      }
    });

  } catch (error) {
    log.error("拒绝资源失败", error as Error, {
      resourceId: await params.then(p => p.id),
      user_uuid: await getUserUuid().catch(() => 'unknown'),
      action: "reject"
    });

    return respErr("拒绝失败，请稍后再试");
  }
}

// 更新用户的总通过审核资源数
async function updateUserApprovedResourcesCount(authorId: string): Promise<void> {
  try {
    await withRetry(async () => {
      const supabase = getSupabaseClient();

      // 计算用户当前已通过审核的资源数
      const { count, error: countError } = await supabase
        .from("resources")
        .select("*", { count: 'exact', head: true })
        .eq("author_id", authorId)
        .eq("status", "approved");

      if (countError) {
        log.error("计算用户审核通过资源数失败", countError, { authorId });
        throw countError;
      }

      const approvedCount = count || 0;

      // 更新用户表中的总通过审核资源数
      const { error: updateError } = await supabase
        .from("users")
        .update({ total_approved_resources: approvedCount })
        .eq("uuid", authorId);

      if (updateError) {
        log.error("更新用户总通过审核资源数失败", updateError, { authorId, approvedCount });
        throw updateError;
      }

      log.info("用户总通过审核资源数更新成功", {
        authorId,
        approvedCount
      });
    });
  } catch (error) {
    log.error("更新用户总通过审核资源数失败", error as Error, { authorId });
    // 不抛出错误，避免影响主要的审核流程
  }
}
