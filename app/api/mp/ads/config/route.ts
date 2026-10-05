import { respData } from '@/lib/resp';
import { mpAdConfig } from '@/lib/mp-resource-access-policy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const response = respData(mpAdConfig());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
