import { NextRequest } from 'next/server';
import { getUserUuid, isUserAdmin } from '@/services/user';
import {
  getOrdersNeedingVerification,
  updateOrderVerificationStatus,
  updatePaymentOrderStatus
} from '@/lib/sqb-db';
import { queryPayment } from '@/lib/sqb-utils';
import { getMainTerminalInfo } from '@/lib/redis-cache';
import {
  VERIFICATION_STATUS,
  determineVerificationResult,
  SQB_ORDER_STATUS
} from '@/lib/sqb-constants';
import { log } from '@/lib/logger';

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';
import { respData, respErr } from '@/lib/resp';

/**
 * 订单核验API
 * POST /api/admin/verify-orders - 执行订单核验
 */
export async function POST(req: NextRequest) {
  try {
    // 检查用户登录状态
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respErr('用户未登录', 401);
    }

    // 检查管理员权限
    if (!(await isUserAdmin())) {
      return respErr('需要管理员权限', 403);
    }

    log.info('开始执行订单核验');

    // 1. 获取终端信息
    const terminalInfo = await getMainTerminalInfo();
    if (!terminalInfo) {
      return respErr('未找到终端信息，请先激活终端');
    }

    // 2. 获取需要核验的订单
    const ordersToVerify = await getOrdersNeedingVerification();
    log.info(`找到 ${ordersToVerify.length} 个需要核验的订单`);

    if (ordersToVerify.length === 0) {
      return respData({
        message: '没有需要核验的订单',
        verified_count: 0,
        results: []
      });
    }

    // 3. 逐个核验订单
    const verificationResults = [];
    let successCount = 0;
    let errorCount = 0;
    let failedCount = 0;

    for (const order of ordersToVerify) {
      try {
        log.info(`开始核验订单: ${order.client_sn}`);

        // 调用收钱吧查询接口
        const queryResult = await queryPayment(
          terminalInfo.terminal_sn,
          terminalInfo.terminal_key,
          order.client_sn
        );

        if (!queryResult.success) {
          // API调用失败，标记为核验失败
          await updateOrderVerificationStatus(
            order.client_sn,
            VERIFICATION_STATUS.VERIFICATION_FAILED,
            `API调用失败: ${queryResult.error || '未知错误'}`
          );
          
          verificationResults.push({
            client_sn: order.client_sn,
            status: 'failed',
            error: queryResult.error || '未知错误'
          });
          failedCount++;
          continue;
        }

        const sqbOrderStatus = queryResult.data?.biz_response?.data?.order_status;
        if (!sqbOrderStatus) {
          // 无法获取订单状态，标记为核验失败
          await updateOrderVerificationStatus(
            order.client_sn,
            VERIFICATION_STATUS.VERIFICATION_FAILED,
            '无法获取收钱吧订单状态'
          );
          
          verificationResults.push({
            client_sn: order.client_sn,
            status: 'failed',
            error: '无法获取收钱吧订单状态'
          });
          failedCount++;
          continue;
        }

        // 4. 处理特殊情况：待支付订单的状态变化
        if (order.status === 'CREATED') {
          if (sqbOrderStatus === SQB_ORDER_STATUS.CREATED) {
            // 待支付且收钱吧也是待支付，跳过
            log.info(`订单 ${order.client_sn} 仍为待支付状态，跳过核验`);
            verificationResults.push({
              client_sn: order.client_sn,
              status: 'skipped',
              message: '订单仍为待支付状态'
            });
            continue;
          } else if (sqbOrderStatus === SQB_ORDER_STATUS.CANCELED) {
            // 待支付但收钱吧显示已取消，更新订单状态
            await updatePaymentOrderStatus(order.client_sn, {
              status: 'CANCELLED',
              order_status: sqbOrderStatus
            });
            await updateOrderVerificationStatus(
              order.client_sn,
              VERIFICATION_STATUS.VERIFIED_CORRECT
            );
            
            verificationResults.push({
              client_sn: order.client_sn,
              status: 'updated',
              message: '订单状态已更新为已取消',
              old_status: 'CREATED',
              new_status: 'CANCELLED'
            });
            successCount++;
            continue;
          } else if (sqbOrderStatus === SQB_ORDER_STATUS.PAID) {
            // 待支付但收钱吧显示支付成功，更新订单状态
            await updatePaymentOrderStatus(order.client_sn, {
              status: 'SUCCESS',
              order_status: sqbOrderStatus
            });
            await updateOrderVerificationStatus(
              order.client_sn,
              VERIFICATION_STATUS.VERIFIED_CORRECT
            );
            
            verificationResults.push({
              client_sn: order.client_sn,
              status: 'updated',
              message: '订单状态已更新为支付成功',
              old_status: 'CREATED',
              new_status: 'SUCCESS'
            });
            successCount++;
            continue;
          }
        }

        // 5. 常规核验：比较状态是否一致
        const verificationResult = determineVerificationResult(order.status, sqbOrderStatus);

        // 根据核验结果决定是否传递错误信息
        if (verificationResult === VERIFICATION_STATUS.VERIFIED_CORRECT) {
          await updateOrderVerificationStatus(
            order.client_sn,
            verificationResult
          );

          verificationResults.push({
            client_sn: order.client_sn,
            status: 'verified_correct',
            message: '核验正确'
          });
          successCount++;
        } else {
          // VERIFIED_ERROR 情况：检查是否需要修正订单状态
          const originalErrorMessage = `本地订单状态为"${order.status}", 收钱吧核验结果为"${sqbOrderStatus}"`;

          // 特殊处理：如果收钱吧显示已支付，但本地状态不是成功，则修正本地状态
          if (sqbOrderStatus === 'PAID' && order.status !== 'SUCCESS') {
            try {
              // 更新订单状态为成功
              await updatePaymentOrderStatus(order.client_sn, {
                status: 'SUCCESS',
                finish_time: new Date()
              });

              // 处理积分充值（如果订单有积分且未处理过）
              if (order.credits_amount && !order.credits_processed) {
                const { processPaymentCredits } = await import('@/lib/sqb-db');
                const creditsResult = await processPaymentCredits(
                  order.client_sn,
                  order.user_uuid,
                  order.credits_amount
                );

                if (creditsResult.success) {
                  log.info('状态修正时积分充值成功', {
                    client_sn: order.client_sn,
                    credits: order.credits_amount,
                    trans_no: creditsResult.transNo,
                    already_processed: creditsResult.already_processed
                  });
                } else {
                  log.error('状态修正时积分充值失败', undefined, {
                    client_sn: order.client_sn,
                    error: creditsResult.error
                  });
                }
              }

              // 记录修正信息
              const correctionMessage = `${originalErrorMessage}，因此更正支付状态为成功`;

              await updateOrderVerificationStatus(
                order.client_sn,
                VERIFICATION_STATUS.VERIFIED_CORRECT,
                correctionMessage
              );

              verificationResults.push({
                client_sn: order.client_sn,
                status: 'corrected',
                message: `状态已修正: ${order.status} -> SUCCESS`,
                old_status: order.status,
                new_status: 'SUCCESS'
              });
              successCount++;

              log.info(`订单状态修正成功`, {
                client_sn: order.client_sn,
                old_status: order.status,
                new_status: 'SUCCESS',
                sqb_status: sqbOrderStatus,
                reason: '收钱吧显示已支付但本地状态未更新'
              });

            } catch (updateError) {
              log.error(`修正订单状态失败`, updateError as Error, {
                client_sn: order.client_sn
              });

              // 修正失败，仍记录为核验错误
              const errorMessage = `业务数据不一致: ${originalErrorMessage}，尝试修正失败`;

              await updateOrderVerificationStatus(
                order.client_sn,
                verificationResult,
                errorMessage
              );

              verificationResults.push({
                client_sn: order.client_sn,
                status: 'verified_error',
                message: `状态不一致且修正失败: 本地=${order.status}, 收钱吧=${sqbOrderStatus}`
              });
              errorCount++;
            }
          } else {
            // 其他类型的状态不一致，记录为核验错误
            const errorMessage = `业务数据不一致: ${originalErrorMessage}`;

            await updateOrderVerificationStatus(
              order.client_sn,
              verificationResult,
              errorMessage
            );

            verificationResults.push({
              client_sn: order.client_sn,
              status: 'verified_error',
              message: `状态不一致: 本地=${order.status}, 收钱吧=${sqbOrderStatus}`
            });
            errorCount++;
          }
        }

      } catch (error) {
        log.error(`核验订单 ${order.client_sn} 时发生异常`, error as Error);
        
        // 标记为核验失败
        try {
          await updateOrderVerificationStatus(
            order.client_sn,
            VERIFICATION_STATUS.VERIFICATION_FAILED,
            `核验异常: ${error instanceof Error ? error.message : '未知错误'}`
          );
        } catch (updateError) {
          log.error(`更新订单 ${order.client_sn} 核验状态失败`, updateError as Error);
        }
        
        verificationResults.push({
          client_sn: order.client_sn,
          status: 'failed',
          error: error instanceof Error ? error.message : '未知错误'
        });
        failedCount++;
      }
    }

    log.info('订单核验完成', {
      total: ordersToVerify.length,
      success: successCount,
      error: errorCount,
      failed: failedCount
    });

    return respData({
      message: `核验完成，共处理 ${ordersToVerify.length} 个订单`,
      total_count: ordersToVerify.length,
      success_count: successCount,
      error_count: errorCount,
      failed_count: failedCount,
      results: verificationResults
    });

  } catch (error) {
    log.error('订单核验失败', error as Error);
    return respErr(`订单核验失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
