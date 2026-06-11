import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { normalizeImportRequest, summarizeImport, verifyResourceImportKey } from "@/lib/resource-import";
import { ResourceImportRequest } from "@/types/resource-import";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!verifyResourceImportKey(req)) {
      return respUnauthorized("导入密钥不正确");
    }

    const body = await req.json() as ResourceImportRequest;
    const resources = await normalizeImportRequest(body);

    return respData({
      summary: summarizeImport(resources),
      resources
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "预览失败";
    log.error("通用资源导入预览失败", error as Error);
    if (message.includes("resources") || message.includes("请求体") || message.includes("最多")) {
      return respInvalidParams(message);
    }
    return respErr(message);
  }
}
