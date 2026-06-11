import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getCreditsByUserUuid } from "@/models/credit";
import { getUserCredits } from "@/services/credit";
import { enrichCreditsWithResources } from "@/utils/creditUtils";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) {
      return respUnauthorized("用户未登录");
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 100);

    const [rawCredits, balance] = await Promise.all([
      getCreditsByUserUuid(user.uuid, page, limit),
      getUserCredits(user.uuid),
    ]);
    const credits = await enrichCreditsWithResources(rawCredits || []);

    return respData({
      credits,
      balance,
      page,
      limit,
    });
  } catch (error) {
    log.error("获取小程序积分记录失败", error as Error);
    return respErr("获取积分记录失败");
  }
}
