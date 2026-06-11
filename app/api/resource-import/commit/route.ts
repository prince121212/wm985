import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { commitImportRequest, verifyResourceImportKey } from "@/lib/resource-import";
import { ResourceImportRequest } from "@/types/resource-import";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!verifyResourceImportKey(req)) {
      return respUnauthorized("导入密钥不正确");
    }

    const body = await req.json() as ResourceImportRequest;
    const result = await commitImportRequest(body);

    return respData(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败";
    log.error("通用资源导入提交失败", error as Error);
    if (message.includes("resources") || message.includes("请求体") || message.includes("最多") || message.includes("不存在")) {
      return respInvalidParams(message);
    }
    return respErr(message);
  }
}
