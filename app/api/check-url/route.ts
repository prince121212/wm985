import { respData, respErr, respInvalidParams } from "@/lib/resp";
import { log } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return respInvalidParams("URL不能为空");
    }

    // 验证URL格式
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      return respInvalidParams("URL格式不正确");
    }

    // 只允许HTTP和HTTPS协议
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return respInvalidParams("只支持HTTP和HTTPS协议");
    }

    log.info("开始检查URL可用性", { url });

    // 使用AbortController设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    try {
      // 使用HEAD请求快速检查
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResourceChecker/1.0)',
        },
        // 不跟随重定向，直接返回状态
        redirect: 'manual'
      });

      clearTimeout(timeoutId);

      const status = response.status;
      const isAvailable = status >= 200 && status < 400; // 2xx和3xx都算可用

      log.info("URL检查完成", { 
        url, 
        status, 
        isAvailable,
        contentType: response.headers.get('content-type') || 'unknown'
      });

      return respData({
        available: isAvailable,
        status,
        message: isAvailable ? "链接可用" : `链接不可用 (状态码: ${status})`,
        contentType: response.headers.get('content-type') || null
      });

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        log.warn("URL检查超时", { url });
        return respData({
          available: false,
          status: 0,
          message: "链接检查超时，可能网络较慢或链接无响应"
        });
      }

      log.warn("URL检查失败", { url, error: error.message });
      return respData({
        available: false,
        status: 0,
        message: `链接检查失败: ${error.message}`
      });
    }

  } catch (error) {
    log.error("URL检查API错误", error as Error);
    return respErr("检查失败，请稍后再试");
  }
}
