import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getResourcesList, getResourcesCount } from "@/models/resource";

// GET /api/admin/resources - 获取管理后台资源列表
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

    const { searchParams } = new URL(req.url);

    // 解析分页参数
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 验证分页参数
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(Math.max(1, pageSize), 100); // 限制最大页面大小为100

    const statusParam = searchParams.get('status');
    const params = {
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') || 'latest',
      status: statusParam === 'all' ? undefined : (statusParam || undefined), // 管理员可以查看所有状态，all表示不筛选状态
      author_id: searchParams.get('author_id') || undefined,
      offset: (validPage - 1) * validPageSize,
      limit: validPageSize,
      isAdmin: true, // 标识这是管理员请求
    };

    log.info("获取管理后台资源列表", {
      user_uuid,
      page: validPage,
      pageSize: validPageSize,
      ...params
    });

    // 并行获取资源列表和总数
    const [resources, totalCount] = await Promise.all([
      getResourcesList(params),
      getResourcesCount({
        category: params.category,
        tags: params.tags,
        search: params.search,
        status: params.status,
        isAdmin: true
      })
    ]);

    const totalPages = Math.ceil(totalCount / validPageSize);

    return respData({
      resources,
      total: totalCount,
      totalPages,
      page: validPage,
      pageSize: validPageSize
    });

  } catch (error) {
    log.error("获取管理后台资源列表失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
      endpoint: "/api/admin/resources"
    });

    return respErr("获取资源列表失败，请稍后再试");
  }
}
