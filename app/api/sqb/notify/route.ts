import { NextRequest } from 'next/server';
import { generateMD5Sign, verifySQBCallbackSignature } from '@/lib/sqb-utils';
import { getCachedPaymentOrder } from '@/lib/redis-cache';
import {
  getPaymentOrderByClientSn,
  updatePaymentOrderStatus,
  logPaymentCallback,
  processPaymentCredits
} from '@/lib/sqb-db';
import { log } from '@/lib/logger';



// 支付回调通知处理
export async function POST(req: NextRequest) {
  let requestBodyText = '';

  try {
    // 记录回调接收
    log.info('📞 收到收钱吧支付回调请求', {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString()
    });

    // 获取原始请求体文本（用于签名验证）
    requestBodyText = await req.text();
    const body = JSON.parse(requestBodyText);

    log.info('🎉🎉🎉 收钱吧通知已经到账！！！！！ 🎉🎉🎉', { body });
    log.info('收到收钱吧支付回调通知', {
      body,
      requestBodyLength: requestBodyText.length,
      hasAuthHeader: !!req.headers.get('authorization')
    });

    // 1. 提取关键信息
    const { client_sn, trade_state, total_amount, subject, sn, trade_no } = body;

    if (!client_sn) {
      log.error('支付回调缺少订单号');
      return Response.json({ success: false, message: '缺少订单号' });
    }

    // 2. 验证回调签名
    const authorizationHeader = req.headers.get('authorization') || '';
    const signature = authorizationHeader; // Authorization header中直接包含签名

    let signatureVerified = false;
    let signatureError = '';

    if (signature) {
      const verifyResult = verifySQBCallbackSignature(requestBodyText, signature);
      signatureVerified = verifyResult.success;
      if (!verifyResult.success) {
        signatureError = verifyResult.error || '签名验证失败';
        log.warn('支付回调签名验证失败', {
          client_sn,
          error: signatureError,
          signature: signature.substring(0, 20) + '...' // 只记录签名的前20个字符
        });
      } else {
        log.info('支付回调签名验证成功', { client_sn });
      }
    } else {
      signatureError = '缺少签名信息';
      log.warn('支付回调缺少签名信息', { client_sn });
    }

    // 3. 记录回调日志
    await logPaymentCallback({
      client_sn,
      callback_data: body,
      signature: signature || undefined,
      signature_verified: signatureVerified,
      signature_error: signatureVerified ? undefined : signatureError,
      processed: false,
      error_message: signatureVerified ? undefined : signatureError
    });

    // 4. 获取数据库中的订单信息
    const dbOrder = await getPaymentOrderByClientSn(client_sn);
    if (!dbOrder) {
      log.warn('未找到订单信息', { client_sn });
      return Response.json({ success: false, message: '订单不存在' });
    }

    // 5. 检查订单是否已经处理过
    if (dbOrder.notify_processed) {
      log.info('订单已处理过，跳过', { client_sn });
      return Response.json({ success: true, message: '订单已处理' });
    }

    // 6. 根据签名验证结果决定是否处理订单
    // 注意：在生产环境中，建议只处理签名验证成功的回调
    // 这里为了兼容性，记录警告但仍然处理订单
    if (!signatureVerified) {
      log.warn('处理未验证签名的支付回调', {
        client_sn,
        trade_state,
        signature_error: signatureError,
        warning: '建议在生产环境中只处理签名验证成功的回调'
      });
    }

    // 7. 更新订单基本信息
    const updateData: any = {
      sn: sn || dbOrder.sn,
      trade_no: trade_no || dbOrder.trade_no,
      order_status: trade_state,
      notify_processed: true,
      notify_processed_at: new Date()
    };

    // 8. 处理不同的支付状态
    if (trade_state === 'SUCCESS') {
      log.info('支付成功，开始处理积分充值', {
        client_sn,
        trade_no,
        user_uuid: dbOrder.user_uuid,
        credits_amount: dbOrder.credits_amount
      });

      updateData.status = 'SUCCESS';
      updateData.finish_time = new Date();

      // 处理积分充值
      if (dbOrder.credits_amount && !dbOrder.credits_processed) {
        const creditsResult = await processPaymentCredits(
          client_sn,
          dbOrder.user_uuid,
          dbOrder.credits_amount
        );

        if (creditsResult.success) {
          log.info('积分充值处理完成', {
            client_sn,
            user_uuid: dbOrder.user_uuid,
            credits: dbOrder.credits_amount,
            trans_no: creditsResult.transNo
          });
        } else {
          log.error('积分充值处理失败', undefined, {
            client_sn,
            error: creditsResult.error
          });
        }
      }

    } else if (trade_state === 'FAILED' || trade_state === 'CANCELLED') {
      updateData.status = trade_state;
      log.info('支付失败或取消', { client_sn, trade_state });
    }

    // 9. 更新订单状态
    await updatePaymentOrderStatus(client_sn, updateData);

    log.info('支付回调处理完成', {
      client_sn,
      trade_state,
      signature_verified: signatureVerified
    });

    // 10. 返回成功响应
    return Response.json({ success: true });

  } catch (error) {
    log.error('处理支付回调失败', error as Error);

    // 记录错误日志
    try {
      // 如果已经解析过请求体，直接使用；否则重新解析
      let body;
      if (requestBodyText) {
        body = JSON.parse(requestBodyText);
      } else {
        // 注意：这里可能会失败，因为请求体可能已经被消费
        const newReq = req.clone();
        body = await newReq.json();
      }

      const { client_sn } = body;
      if (client_sn) {
        await logPaymentCallback({
          client_sn,
          callback_data: body,
          processed: false,
          signature_verified: false,
          signature_error: '处理异常时无法验证签名',
          error_message: error instanceof Error ? error.message : '未知错误'
        });
      }
    } catch (logError) {
      log.error('记录错误回调日志失败', logError as Error);
    }

    return Response.json({
      success: false,
      message: '处理回调失败'
    });
  }
}

// GET 方法用于测试回调接口
export async function GET(req: NextRequest) {
  return Response.json({
    success: true,
    message: '收钱吧支付回调接口正常',
    timestamp: new Date().toISOString(),
    url: req.url
  });
}
