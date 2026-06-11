import { respData, respErr } from "@/lib/resp";
import { getAllTags, getPopularTags } from "@/models/tag";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "popular";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100);
    const tags = type === "all" ? (await getAllTags()).slice(0, limit) : await getPopularTags(limit, 0);

    return respData({ tags, total: tags.length, type, limit });
  } catch (error) {
    log.error("获取小程序标签失败", error as Error);
    return respErr("获取标签失败");
  }
}
