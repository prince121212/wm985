import { NextRequest } from "next/server";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { respData, respUnauthorized, respErr } from "@/lib/resp";
import { log } from "@/lib/logger";
import {
  getPaymentOrderByClientSn,
  createRefundRecord,
  updateRefundRecord,
  getRefundsByOrderSn,
  processRefundTransaction
} from "@/lib/sqb-db";
import { refundPayment } from "@/lib/sqb-utils";
import { getMainTerminalInfo } from "@/lib/redis-cache";

// 生成退款序列号
function generateRefundRequestNo(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REFUND_${timestamp}_${random}`;
}

// POST /api/admin/refund - 处理退款请求
export async function POST(req: NextRequest) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    // 解析请求参数
    const body = await req.json();
    const { client_sn, refund_amount, refund_reason } = body;

    // 验证必要参数
    if (!client_sn) {
      return respErr("订单号不能为空");
    }

    if (!refund_amount || refund_amount <= 0) {
      return respErr("退款金额必须大于0");
    }

    log.info("开始处理退款请求", {
      user_uuid,
      client_sn,
      refund_amount,
      refund_reason
    });

    // 1. 获取订单信息
    const order = await getPaymentOrderByClientSn(client_sn);
    if (!order) {
      return respErr("订单不存在");
    }

    // 2. 验证订单状态（只能退款已支付成功的订单）
    const allowedStatuses = ['SUCCESS', 'PAID', 'PARTIAL_REFUNDED'];
    if (!allowedStatuses.includes(order.status)) {
      return respErr(`订单状态不允许退款，当前状态：${order.status}`);
    }

    // 3. 计算可退款金额
    const refundedAmount = order.refund_amount || 0;
    const availableRefundAmount = order.total_amount - refundedAmount;
    
    if (refund_amount > availableRefundAmount) {
      return respErr(`退款金额不能超过可退款金额 ${availableRefundAmount / 100} 元`);
    }

    // 4. 获取终端信息
    const terminalInfo = await getMainTerminalInfo();
    if (!terminalInfo) {
      return respErr("获取终端信息失败，请稍后重试");
    }

    // 5. 生成退款序列号
    const refundRequestNo = generateRefundRequestNo();

    // 6. 创建退款记录
    const refundRecord = await createRefundRecord({
      client_sn,
      refund_request_no: refundRequestNo,
      refund_amount,
      refund_reason,
      status: 'PENDING',
      operator: user_uuid
    });

    log.info("退款记录已创建", {
      refund_request_no: refundRequestNo,
      client_sn,
      refund_amount
    });

    // 7. 调用收钱吧退款接口
    const refundResult = await refundPayment(
      terminalInfo.terminal_sn,
      terminalInfo.terminal_key,
      {
        client_sn,
        sn: order.sn,
        refund_request_no: refundRequestNo,
        refund_amount,
        operator: user_uuid,
        refund_reason
      }
    );

    log.info("收钱吧退款接口调用完成", {
      refund_request_no: refundRequestNo,
      success: refundResult.success,
      data: refundResult.data
    });

    // 8. 处理退款结果
    if (refundResult.success && refundResult.data) {
      const responseData = refundResult.data;
      const bizResponse = responseData.biz_response;

      // 检查是否是成功的退款
      if (responseData.result_code === '200' && bizResponse?.result_code === 'REFUND_SUCCESS') {
        // 退款成功 - 使用事务处理
        const refundData = bizResponse.data;

        // 使用事务处理退款成功的数据更新
        const transactionResult = await processRefundTransaction(
          client_sn,
          refundRequestNo,
          refund_amount,
          {
            finishTime: refundData.finish_time ? new Date(parseInt(refundData.finish_time)) : new Date(),
            channelFinishTime: refundData.channel_finish_time ? new Date(parseInt(refundData.channel_finish_time)) : undefined,
            sqbResponse: refundResult.data,
            sn: refundData.sn,
            tradeNo: refundData.trade_no,
            settlementAmount: parseInt(refundData.settlement_amount || '0'),
            netAmount: parseInt(refundData.net_amount || '0')
          }
        );

        if (transactionResult.success) {
          log.info("退款处理成功", {
            client_sn,
            refund_request_no: refundRequestNo,
            refund_amount,
            new_order_status: transactionResult.data?.new_order_status
          });

          return respData({
            success: true,
            message: "退款成功",
            refund_request_no: refundRequestNo,
            refund_amount,
            remaining_amount: (transactionResult.data?.remaining_amount || 0) / 100
          });
        } else {
          // 事务处理失败
          log.error("退款事务处理失败", new Error(transactionResult.error || '未知错误'), {
            client_sn,
            refund_request_no: refundRequestNo
          });

          return respErr(`退款处理失败：${transactionResult.error}`, 1003);
        }
      } else {
        // 退款失败 - 收钱吧返回了业务错误
        const errorCode = responseData.error_code;
        const errorMessage = responseData.error_message || '退款失败';

        await updateRefundRecord(refundRequestNo, {
          status: 'FAILED',
          error_message: errorMessage,
          sqb_response: refundResult.data
        });

        log.error("退款失败", new Error(errorMessage), {
          client_sn,
          refund_request_no: refundRequestNo,
          error_code: errorCode
        });

        // 根据错误码提供更友好的错误信息
        let friendlyMessage = errorMessage;
        if (errorCode === 'EXTERNAL_SERVICE_EXCEPTION' && errorMessage.includes('今日新收款余额小于退款额')) {
          friendlyMessage = '商户账户余额不足，无法处理退款。请联系收钱吧客服或等待资金结算后重试。';
        }

        return respErr(`${friendlyMessage}`, 1003); // 使用业务错误码，返回400状态
      }
    } else {
      // 网络错误或其他错误
      const errorMessage = refundResult.error || '退款接口调用失败';

      await updateRefundRecord(refundRequestNo, {
        status: 'FAILED',
        error_message: errorMessage,
        sqb_response: refundResult.data
      });

      log.error("退款接口调用失败", new Error(errorMessage), {
        client_sn,
        refund_request_no: refundRequestNo
      });

      return respErr(`退款失败：${errorMessage}`, 1003); // 使用业务错误码，返回400状态
    }

  } catch (error) {
    log.error('退款处理异常', error as Error);
    return respErr('退款处理失败，请稍后重试'); // 系统异常，保持500状态
  }
}

// GET /api/admin/refund - 获取订单的退款记录
export async function GET(req: NextRequest) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    // 解析查询参数
    const url = new URL(req.url);
    const client_sn = url.searchParams.get('client_sn');

    if (!client_sn) {
      return respErr("订单号不能为空");
    }

    // 获取退款记录
    const refunds = await getRefundsByOrderSn(client_sn);

    return respData({
      refunds: refunds.map(refund => ({
        ...refund,
        refund_amount_yuan: (refund.refund_amount / 100).toFixed(2),
        created_at: refund.created_at,
        finish_time: refund.finish_time
      }))
    });

  } catch (error) {
    log.error('获取退款记录失败', error as Error);
    return respErr('获取退款记录失败，请稍后重试');
  }
}
