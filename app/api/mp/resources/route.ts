import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getResourcesList, getResourcesCount, insertResource } from "@/models/resource";
import { findCategoryByName } from "@/models/category";
import { addResourceTags } from "@/models/tag";
import { getUuid } from "@/lib/hash";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

async function resolveCategory(rawCategory: string | null): Promise<string | undefined> {
  if (!rawCategory) return undefined;
  const parsed = parseInt(rawCategory);
  if (!Number.isNaN(parsed) && parsed > 0) return rawCategory;

  const category = await findCategoryByName(rawCategory.trim());
  return category?.id?.toString();
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50);
    const category = await resolveCategory(searchParams.get("category"));
    const tags = searchParams.get("tags")?.split(",").map(t => t.trim()).filter(Boolean);
    const search = searchParams.get("search")?.trim() || undefined;
    const sort = searchParams.get("sort") || "latest";
    const is_free = parseBoolean(searchParams.get("is_free") || searchParams.get("free"));

    const params = {
      category,
      tags,
      search,
      sort,
      status: "approved",
      is_free,
      offset,
      limit,
    };

    const [resources, total] = await Promise.all([
      getResourcesList(params),
      getResourcesCount({
        category,
        tags,
        search,
        status: "approved",
        is_free,
      }),
    ]);

    return respData({ resources, total, offset, limit });
  } catch (error) {
    log.error("获取小程序资源列表失败", error as Error);
    return respErr("获取资源列表失败");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) {
      return respUnauthorized("用户未登录");
    }

    const body = await req.json();
    const title = body?.title?.toString().trim();
    const description = body?.description?.toString().trim();
    const content = body?.content?.toString().trim() || "";
    const fileUrl = body?.file_url?.toString().trim();
    const categoryId = parseInt(body?.category_id);
    const isFree = parseBoolean(body?.is_free) ?? true;
    const credits = isFree ? 0 : Math.max(parseInt(body?.credits || "0"), 0);
    const tags = Array.isArray(body?.tags) ? body.tags.map((tag: any) => tag?.toString().trim()).filter(Boolean).slice(0, 10) : [];

    if (!title) return respInvalidParams("资源标题不能为空");
    if (!description) return respInvalidParams("资源描述不能为空");
    if (!fileUrl) return respInvalidParams("资源链接不能为空");
    if (!categoryId) return respInvalidParams("请选择资源分类");
    if (!isFree && credits <= 0) return respInvalidParams("请设置正确的积分数量");

    try {
      new URL(fileUrl.startsWith("http") ? fileUrl : `https://${fileUrl}`);
    } catch {
      return respInvalidParams("资源链接格式不正确");
    }

    const resourceUuid = getUuid();
    const createdResource = await insertResource({
      uuid: resourceUuid,
      title: title.slice(0, 100),
      description: description.slice(0, 500),
      content: content.slice(0, 2000),
      file_url: fileUrl.startsWith("http") ? fileUrl : `https://${fileUrl}`,
      category_id: categoryId,
      author_id: user.uuid,
      status: "pending",
      rating_avg: 0,
      rating_count: 0,
      view_count: 0,
      access_count: 0,
      is_featured: false,
      is_free: isFree,
      credits,
      top: false,
    });

    if (tags.length > 0 && createdResource.id) {
      await addResourceTags(createdResource.id, tags);
    }

    return respData({
      resource: {
        uuid: resourceUuid,
        title,
        status: "pending",
        is_free: isFree,
        credits,
      },
      message: "资源提交成功，审核通过后将公开显示",
    });
  } catch (error) {
    log.error("小程序创建资源失败", error as Error);
    return respErr("创建资源失败");
  }
}
