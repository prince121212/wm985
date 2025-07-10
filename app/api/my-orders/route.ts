import { NextRequest } from 'next/server';
import { getUserUuid } from '@/services/user';
import { getUserPaymentOrders } from '@/lib/sqb-db';
import { log } from '@/lib/logger';

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 用户身份验证
    let userUuid: string;
    try {
      userUuid = await getUserUuid();
      if (!userUuid) {
        return Response.json({
          success: false,
          message: '用户未登录'
        }, { status: 401 });
      }
    } catch (error) {
      log.error('获取用户UUID失败', error as Error, { user_uuid: 'unknown' });
      return Response.json({
        success: false,
        message: '认证失败'
      }, { status: 401 });
    }

    // 获取分页参数
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    log.info('获取用户订单列表', { 
      user_uuid: userUuid, 
      page, 
      limit, 
      offset 
    });

    // 获取用户的支付订单
    const result = await getUserPaymentOrders(userUuid, limit, offset);

    // 格式化订单数据
    const formattedOrders = result.orders.map(order => ({
      id: order.id,
      client_sn: order.client_sn,
      total_amount: order.total_amount,
      subject: order.subject,
      payway_name: order.payway_name,
      status: order.status,
      credits_amount: order.credits_amount,
      credits_processed: order.credits_processed,
      created_at: order.created_at,
      updated_at: order.updated_at,
      finish_time: order.finish_time,
      trade_no: order.trade_no,
      // 格式化显示金额（从分转换为元）
      amount_yuan: (order.total_amount / 100).toFixed(2),
      // 状态中文显示
      status_text: getStatusText(order.status),
      // 支付方式显示
      payway_display: order.payway_name || (order.payway === '2' ? '支付宝' : '微信')
    }));

    log.info('用户订单列表获取成功', { 
      user_uuid: userUuid, 
      total: result.total,
      orders_count: formattedOrders.length 
    });

    return Response.json({
      success: true,
      message: '获取订单列表成功',
      data: {
        orders: formattedOrders,
        total: result.total,
        page,
        limit,
        has_more: offset + formattedOrders.length < result.total
      }
    });

  } catch (error) {
    log.error('获取用户订单列表失败', error as Error, { user_uuid: 'unknown' });
    return Response.json({
      success: false,
      message: '获取订单列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

// 状态文本映射
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'CREATED': '待支付',
    'PAID': '已支付',
    'SUCCESS': '支付成功',
    'FAILED': '支付失败',
    'CANCELLED': '已取消',
    'EXPIRED': '已过期',
    'REFUNDED': '已退款',
    'PARTIAL_REFUNDED': '部分退款'
  };
  
  return statusMap[status] || status;
}
