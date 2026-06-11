import { respData, respErr } from "@/lib/resp";
import { getAllCategories, buildCategoryTree } from "@/models/category";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeChildren = searchParams.get("include_children") === "true";
    const includeCount = searchParams.get("include_count") !== "false";
    const categories = await getAllCategories(includeCount);

    return respData({
      categories: includeChildren ? buildCategoryTree(categories) : categories,
      total: categories.length,
    });
  } catch (error) {
    log.error("获取小程序分类失败", error as Error);
    return respErr("获取分类失败");
  }
}
