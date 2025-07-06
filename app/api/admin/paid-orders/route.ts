import { NextRequest } from "next/server";
import { getSQBPaidOrders } from "@/models/order";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { respData, respUnauthorized, respErr } from "@/lib/resp";
import { log } from "@/lib/logger";

// GET /api/admin/paid-orders - 获取支付订单列表
export async function GET(req: NextRequest) {
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

    // 解析查询参数
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const status = url.searchParams.get('status') || undefined;
    const verificationStatus = url.searchParams.get('verification_status') || undefined;

    // 验证分页参数
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(Math.max(1, pageSize), 100); // 限制最大页面大小为100

    log.info("获取支付订单列表", {
      user_uuid,
      page: validPage,
      pageSize: validPageSize,
      status,
      verificationStatus
    });

    // 获取支付订单数据
    const result = await getSQBPaidOrders(validPage, validPageSize, status, verificationStatus);

    if (!result) {
      return respErr("获取支付订单失败");
    }

    const { orders, total } = result;
    const totalPages = Math.ceil(total / validPageSize);

    return respData({
      orders,
      total,
      totalPages,
      currentPage: validPage,
      pageSize: validPageSize
    });

  } catch (error) {
    log.error("获取支付订单列表失败", error as Error);
    return respErr("获取支付订单列表失败");
  }
}
