import { respData, respErr, respForbidden, respInvalidParams, respNotFound, respUnauthorized } from '@/lib/resp';
import { getMpUser } from '@/lib/mp-auth';
import { findResourceByUuid } from '@/models/resource';
import { createResourceAdSession } from '@/models/mp-resource-ad';
import { mpAdConfig, resourceCreditsCost } from '@/lib/mp-resource-access-policy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized('请先登录后获取资源');
    const { id } = await params;
    if (!id || id.length > 255) return respInvalidParams('资源ID无效');
    const resource = await findResourceByUuid(id);
    if (!resource || resource.status !== 'approved') return respNotFound('资源不存在或暂不可访问');
    if (resourceCreditsCost(resource) > 0) return respInvalidParams('该资源需要积分，请刷新页面');
    if (!resource.file_url) return respNotFound('资源链接暂不可用');
    const config = mpAdConfig();
    if (!config.enabled) return respForbidden('广告暂不可用，请稍后再试');
    const session = await createResourceAdSession(user.uuid, id, config.ad_unit_id);
    const response = respData({ session_id: session.id, ad_unit_id: session.ad_unit_id, expires_at: session.expires_at });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return respErr('暂时无法开始广告，请稍后重试');
  }
}
