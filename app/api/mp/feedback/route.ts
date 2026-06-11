import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { insertFeedback } from "@/models/feedback";
import { getIsoTimestr } from "@/lib/time";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const body = await req.json();
    const content = body?.content?.toString().trim();
    const rating = Number(body?.rating || 10);

    if (!content) return respInvalidParams("反馈内容不能为空");
    if (content.length > 1000) return respInvalidParams("反馈内容过长，最多1000字符");

    await insertFeedback({
      user_uuid: user.uuid,
      content,
      rating: Number.isFinite(rating) ? rating : 10,
      created_at: getIsoTimestr(),
      status: "created",
    });

    return respData({ message: "反馈提交成功，感谢您的宝贵意见！" });
  } catch (error) {
    log.error("提交小程序反馈失败", error as Error);
    return respErr("反馈提交失败");
  }
}
