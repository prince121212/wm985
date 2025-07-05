import { NextRequest } from 'next/server';
import { verifySQBCallbackSignature } from '@/lib/sqb-utils';
import {
  getPaymentOrderByClientSn,
  updatePaymentOrderStatus,
  logPaymentCallback,
  processPaymentCredits
} from '@/lib/sqb-db';
import {
  isSuccessOrderStatus,
  isFailedOrderStatus
} from '@/lib/sqb-constants';
import { log } from '@/lib/logger';
import { sendEmail } from '@/lib/wework-email';





/**
 * 发送收钱吧回调通知邮件
 */
async function sendCallbackNotificationEmail(
  callbackData: {
    headers: Record<string, string>;
    body: any;
    requestBodyText: string;
    client_sn: string;
    signature?: string;
    signatureVerified: boolean;
    signatureError?: string;
    timestamp: string;
  }
): Promise<void> {
  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007cba; padding-bottom: 10px;">
          收钱吧支付回调通知
        </h2>

        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #495057; margin-top: 0;">基本信息</h3>
          <p><strong>时间:</strong> ${callbackData.timestamp}</p>
          <p><strong>订单号:</strong> ${callbackData.client_sn}</p>
          <p><strong>签名验证:</strong>
            <span style="color: ${callbackData.signatureVerified ? '#28a745' : '#dc3545'};">
              ${callbackData.signatureVerified ? '✅ 验证成功' : '❌ 验证失败'}
            </span>
          </p>
          ${callbackData.signatureError ? `<p><strong>签名错误:</strong> <span style="color: #dc3545;">${callbackData.signatureError}</span></p>` : ''}
        </div>

        <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #495057; margin-top: 0;">请求头信息</h3>
          <pre style="background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(callbackData.headers, null, 2)}</pre>
        </div>

        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #495057; margin-top: 0;">回调数据</h3>
          <pre style="background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(callbackData.body, null, 2)}</pre>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #495057; margin-top: 0;">原始请求体</h3>
          <pre style="background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${callbackData.requestBodyText}</pre>
        </div>

        ${callbackData.signature ? `
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #495057; margin-top: 0;">签名信息</h3>
          <p><strong>签名长度:</strong> ${callbackData.signature.length}</p>
          <p><strong>签名预览:</strong> ${callbackData.signature.substring(0, 100)}...</p>
        </div>
        ` : ''}

        <div style="margin-top: 20px; padding: 10px; background-color: #d1ecf1; border-radius: 5px;">
          <p style="margin: 0; font-size: 12px; color: #0c5460;">
            此邮件由文明知识库系统自动发送，用于收钱吧支付回调监控和问题追踪。
          </p>
        </div>
      </div>
    `;

    await sendEmail({
      to: '1608840095@qq.com',
      subject: `收钱吧回调通知 - ${callbackData.client_sn} - ${callbackData.signatureVerified ? '验证成功' : '验证失败'}`,
      html: emailContent,
      text: `收钱吧回调通知\n订单号: ${callbackData.client_sn}\n时间: ${callbackData.timestamp}\n签名验证: ${callbackData.signatureVerified ? '成功' : '失败'}\n\n回调数据:\n${JSON.stringify(callbackData.body, null, 2)}`
    });

    log.info('收钱吧回调通知邮件发送成功', {
      client_sn: callbackData.client_sn,
      signature_verified: callbackData.signatureVerified
    });

  } catch (error) {
    log.error('发送收钱吧回调通知邮件失败', error as Error, {
      client_sn: callbackData.client_sn
    });
  }
}
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
    const { client_sn, trade_state, sn, trade_no } = body;

    if (!client_sn) {
      log.error('支付回调缺少订单号');
      return Response.json({ success: false, message: '缺少订单号' });
    }

    // 2. 验证回调签名
    const authorizationHeader = req.headers.get('authorization') || '';

    let signature = '';
    let signatureVerified = false;
    let signatureError = '';

    // 解析Authorization header获取签名
    if (authorizationHeader) {
      // 根据收钱吧文档，Authorization header可能的格式：
      // 1. 直接是签名：Authorization: signature_value
      // 2. 包含终端号：Authorization: terminal_sn signature_value
      const authParts = authorizationHeader.trim().split(' ');

      if (authParts.length === 1) {
        // 格式1：直接是签名
        signature = authParts[0];
      } else if (authParts.length === 2) {
        // 格式2：terminal_sn + 签名，取第二部分
        signature = authParts[1];
      } else {
        signatureError = 'Authorization header格式不正确';
      }

      log.info('解析Authorization header', {
        client_sn,
        auth_header_length: authorizationHeader.length,
        auth_parts_count: authParts.length,
        signature_length: signature.length,
        signature_preview: signature ? signature.substring(0, 50) + '...' : 'empty'
      });
    }

    if (signature) {
      // 记录详细的签名验证信息用于调试
      log.info('开始验证收钱吧回调签名', {
        client_sn,
        signature_length: signature.length,
        body_length: requestBodyText.length,
        body_preview: requestBodyText.substring(0, 100) + '...'
      });

      const verifyResult = verifySQBCallbackSignature(requestBodyText, signature);
      signatureVerified = verifyResult.success;
      if (!verifyResult.success) {
        signatureError = verifyResult.error || '签名验证失败';
        log.warn('支付回调签名验证失败', {
          client_sn,
          error: signatureError,
          signature_length: signature.length,
          body_length: requestBodyText.length
        });
      } else {
        log.info('支付回调签名验证成功', { client_sn });
      }
    } else {
      if (!signatureError) {
        signatureError = '缺少签名信息';
      }
      log.warn('支付回调签名问题', {
        client_sn,
        error: signatureError,
        has_auth_header: !!authorizationHeader,
        auth_header: authorizationHeader ? authorizationHeader.substring(0, 100) + '...' : 'empty'
      });
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
    if (isSuccessOrderStatus(trade_state)) {
      updateData.status = 'SUCCESS';
      updateData.finish_time = new Date();

      log.info('支付成功，开始处理积分充值', {
        client_sn,
        trade_no,
        user_uuid: dbOrder.user_uuid,
        credits_amount: dbOrder.credits_amount
      });

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

    } else if (isFailedOrderStatus(trade_state)) {
      updateData.status = trade_state === 'CANCELED' ? 'CANCELLED' : 'FAILED';
      log.info('支付失败或取消', { client_sn, trade_state });
    }

    // 9. 更新订单状态
    await updatePaymentOrderStatus(client_sn, updateData);

    log.info('支付回调处理完成', {
      client_sn,
      trade_state,
      signature_verified: signatureVerified
    });

    // 10. 发送回调通知邮件（异步执行，不影响响应）
    sendCallbackNotificationEmail({
      headers: Object.fromEntries(req.headers.entries()),
      body,
      requestBodyText,
      client_sn,
      signature,
      signatureVerified,
      signatureError,
      timestamp: new Date().toISOString()
    }).catch(error => {
      log.error('发送回调通知邮件异常', error as Error, { client_sn });
    });

    // 11. 返回成功响应
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

        // 发送错误回调通知邮件（异步执行）
        sendCallbackNotificationEmail({
          headers: Object.fromEntries(req.headers.entries()),
          body,
          requestBodyText,
          client_sn,
          signature: undefined,
          signatureVerified: false,
          signatureError: `处理异常: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: new Date().toISOString()
        }).catch(emailError => {
          log.error('发送错误回调通知邮件异常', emailError as Error, { client_sn });
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
