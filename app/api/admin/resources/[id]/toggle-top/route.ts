import { respData, respErr, respUnauthorized, respInvalidParams, respNotFound } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { findResourceByUuid } from "@/models/resource";
import { getSupabaseClient } from "@/models/db";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/resources/[id]/toggle-top - 切换资源置顶状态
export async function POST(req: Request, { params }: RouteParams) {
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

    const { id } = await params;
    if (!id) {
      return respInvalidParams("资源ID不能为空");
    }

    log.info("管理员切换资源置顶状态", { resourceId: id, user_uuid, action: "toggle-top" });

    // 检查资源是否存在
    const resource = await findResourceByUuid(id);
    if (!resource) {
      return respNotFound("资源不存在");
    }

    const resourceInfo = {
      uuid: resource.uuid,
      title: resource.title,
      currentTopStatus: Boolean(resource.top) // 确保布尔值类型安全
    };

    // 切换置顶状态
    const newTopStatus = !resourceInfo.currentTopStatus;
    
    const supabase = getSupabaseClient();

    // 使用乐观锁定确保数据一致性：基于当前状态进行更新
    const { data: updateData, error: updateError } = await supabase
      .from("resources")
      .update({
        top: newTopStatus,
        updated_at: new Date().toISOString()
      })
      .eq("uuid", id)
      .eq("top", resourceInfo.currentTopStatus) // 乐观锁：只有当前状态匹配时才更新
      .select("uuid, top");

    if (updateError) {
      log.error("切换资源置顶状态失败", updateError, { resourceId: id, newTopStatus });
      throw updateError;
    }

    // 检查是否实际更新了记录（乐观锁检查）
    if (!updateData || updateData.length === 0) {
      log.warn("资源置顶状态已被其他操作修改", {
        resourceId: id,
        expectedCurrentStatus: resourceInfo.currentTopStatus,
        attemptedNewStatus: newTopStatus
      });
      return respErr("资源状态已被修改，请刷新页面后重试");
    }

    const actionText = newTopStatus ? "置顶" : "取消置顶";
    log.info(`资源${actionText}成功`, {
      resourceId: id,
      resourceTitle: resourceInfo.title,
      topStatus: newTopStatus,
      user_uuid
    });

    return respData({
      message: `资源已${actionText}`,
      resource: {
        uuid: resourceInfo.uuid,
        title: resourceInfo.title,
        top: newTopStatus
      }
    });

  } catch (error) {
    // 安全地获取参数，避免Promise rejection
    const safeParams = await params.catch(() => ({ id: 'unknown' }));
    const safeUserUuid = await getUserUuid().catch(() => null);

    log.error("切换资源置顶状态失败", error as Error, {
      resourceId: safeParams.id,
      user_uuid: safeUserUuid
    });
    return respErr("切换置顶状态失败");
  }
}
