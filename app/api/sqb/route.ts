import { NextRequest } from 'next/server';
import {
  activateTerminal,
  checkinTerminal,
  createPayment,
  queryPayment,
  generateDeviceId,
  SQB_CONFIG,
  diagnoseSQBConnection
} from '@/lib/sqb-utils';
import {
  storeMainTerminalInfo,
  getMainTerminalInfo,
  hasCheckedInToday,
  markCheckinToday,
  cachePaymentOrder,
  getCachedPaymentOrder,
  getRedisStatus,
  type TerminalInfo,
  type PaymentOrderData
} from '@/lib/redis-cache';
import {
  createPaymentOrder,
  getPaymentOrderByClientSn,
  updatePaymentOrderStatus,
  type SQBPaymentOrder
} from '@/lib/sqb-db';
import { getSnowId } from '@/lib/hash';
import { log } from '@/lib/logger';
import { getUserUuid, isUserAdmin } from '@/services/user';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    log.info('收钱吧API GET请求', { action: action || undefined, timestamp: new Date().toISOString() });

    // 检查用户认证
    if (action === 'admin_query_payment' || action === 'reactivate') {
      // 管理员操作需要管理员权限
      if (!(await isUserAdmin())) {
        return Response.json({
          success: false,
          message: '需要管理员权限'
        }, { status: 403 });
      }
    } else {
      // 其他操作需要用户登录
      try {
        const userUuid = await getUserUuid();
        if (!userUuid) {
          return Response.json({
            success: false,
            message: '用户未登录'
          }, { status: 401 });
        }
      } catch (error) {
        log.error('获取用户UUID失败', error as Error);
        return Response.json({
          success: false,
          message: '认证失败'
        }, { status: 401 });
      }
    }

    switch (action) {
      case 'admin_query_payment':
        // 管理员查询订单状态（临时调试用）
        const adminClientSn = searchParams.get('client_sn');
        if (!adminClientSn) {
          return Response.json({
            success: false,
            message: '缺少订单号参数'
          });
        }

        // 获取终端信息
        const adminTerminalInfo = await getMainTerminalInfo();
        if (!adminTerminalInfo) {
          return Response.json({
            success: false,
            message: '未找到终端信息'
          });
        }

        // 查询支付状态
        const adminQueryResult = await queryPayment(
          adminTerminalInfo.terminal_sn,
          adminTerminalInfo.terminal_key,
          adminClientSn
        );

        // 同时查询数据库中的订单信息
        const dbOrder = await getPaymentOrderByClientSn(adminClientSn);

        return Response.json({
          success: true,
          message: '管理员查询支付状态成功',
          data: {
            sqb_query_result: adminQueryResult,
            db_order: dbOrder,
            analysis: {
              sqb_status: adminQueryResult.success ? adminQueryResult.data?.biz_response?.data?.order_status : 'QUERY_FAILED',
              db_status: dbOrder?.status || 'NOT_FOUND',
              is_paid_in_sqb: adminQueryResult.success && adminQueryResult.data?.biz_response?.data?.order_status === 'PAID',
              is_processed_in_db: dbOrder?.credits_processed || false
            }
          }
        });



      case 'query_payment':
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
          log.error('获取用户UUID失败', error as Error);
          return Response.json({
            success: false,
            message: '认证失败'
          }, { status: 401 });
        }

        const clientSn = searchParams.get('client_sn');
        if (!clientSn) {
          return Response.json({
            success: false,
            message: '缺少订单号参数'
          });
        }

        // 获取终端信息
        const terminalInfo = await getMainTerminalInfo();
        if (!terminalInfo) {
          return Response.json({
            success: false,
            message: '未找到终端信息'
          });
        }

        // 查询支付状态
        const queryResult = await queryPayment(
          terminalInfo.terminal_sn,
          terminalInfo.terminal_key,
          clientSn
        );

        if (!queryResult.success) {
          return Response.json({
            success: false,
            message: queryResult.data?.message || queryResult.error || '查询支付状态失败',
            error: queryResult.error
          });
        }

        // 如果支付成功，更新订单状态并处理积分充值
        // 检查正确的数据路径：queryResult.data.biz_response.data.order_status
        const orderStatus = queryResult.data?.biz_response?.data?.order_status;
        if (orderStatus === 'PAID') {
          // 获取订单信息
          const orderInfo = await getPaymentOrderByClientSn(clientSn);
          if (orderInfo && orderInfo.status === 'CREATED') {
            // 更新订单状态为成功
            await updatePaymentOrderStatus(clientSn, {
              status: 'SUCCESS',
              order_status: 'PAID',
              finish_time: new Date(),
              trade_no: queryResult.data?.biz_response?.data?.trade_no || null,
              sn: queryResult.data?.biz_response?.data?.sn || null
            });

            log.info('支付成功，订单状态已更新', {
              client_sn: clientSn,
              user_uuid: userUuid,
              trade_no: queryResult.data?.biz_response?.data?.trade_no
            });
          }

          // 处理积分充值
          if (orderInfo && !orderInfo.credits_processed && orderInfo.credits_amount) {
            log.info('轮询中发现支付成功，开始处理积分充值', {
              client_sn: clientSn,
              user_uuid: userUuid,
              credits_amount: orderInfo.credits_amount
            });

            try {
              const { processPaymentCredits } = await import('@/lib/sqb-db');
              const creditsResult = await processPaymentCredits(clientSn, userUuid, orderInfo.credits_amount);

              if (creditsResult.success) {
                log.info('轮询中积分充值成功', {
                  client_sn: clientSn,
                  credits: orderInfo.credits_amount,
                  trans_no: creditsResult.transNo,
                  already_processed: creditsResult.already_processed
                });
              } else {
                log.error('轮询中积分充值失败', undefined, {
                  client_sn: clientSn,
                  error: creditsResult.error
                });
              }
            } catch (creditsError) {
              log.error('轮询中处理积分充值异常', creditsError as Error, { client_sn: clientSn });
            }
          }
        }

        // 构建返回数据
        const responseData = {
          status: orderStatus === 'PAID' ? 'SUCCESS' : 'PENDING',
          result_code: queryResult.data?.result_code,
          error_code: queryResult.data?.error_code,
          error_message: queryResult.data?.error_message,
          biz_response: queryResult.data
        };

        // 如果支付成功，添加积分信息到响应中
        if (orderStatus === 'PAID') {
          try {
            // 获取最新的订单信息（包含积分处理结果）
            const updatedOrder = await getPaymentOrderByClientSn(clientSn);
            if (updatedOrder) {
              // 获取用户当前积分
              const { getUserCredits } = await import('@/services/credit');
              const userCreditsInfo = await getUserCredits(userUuid);
              const currentCredits = userCreditsInfo.left_credits;

              responseData.payment_success_info = {
                charged_amount: (updatedOrder.total_amount || 0) / 100,
                charged_credits: updatedOrder.credits_amount || 0,
                previous_credits: Math.max(0, currentCredits - (updatedOrder.credits_amount || 0)),
                current_credits: currentCredits,
                order_info: {
                  client_sn: updatedOrder.client_sn,
                  status: updatedOrder.status,
                  finish_time: updatedOrder.finish_time,
                  trade_no: updatedOrder.trade_no
                }
              };
            }
          } catch (creditsInfoError) {
            log.error('获取积分信息失败', creditsInfoError as Error, { client_sn: clientSn });
            // 不影响主流程，继续返回支付成功状态
          }
        }

        return Response.json({
          success: true,
          message: '查询支付状态成功',
          data: responseData
        });

      case 'reactivate':
        // 重新激活终端
        const newActivationCode = '84038959';
        const deviceId = generateDeviceId();

        log.info('开始重新激活终端', { deviceId, activationCode: newActivationCode });

        const activateResult = await activateTerminal(deviceId, newActivationCode);

        if (!activateResult.success) {
          return Response.json({
            success: false,
            message: activateResult.data?.message || activateResult.error || '激活失败',
            error: activateResult.error
          });
        }

        // 存储新的终端信息
        const newTerminalInfo: TerminalInfo = {
          terminal_sn: activateResult.data.terminal_sn,
          terminal_key: activateResult.data.terminal_key,
          device_id: deviceId,
          activated_at: new Date().toISOString(),
          activation_code: newActivationCode
        };

        await storeMainTerminalInfo(newTerminalInfo);

        log.info('终端重新激活成功', newTerminalInfo);

        return Response.json({
          success: true,
          message: '终端重新激活成功',
          data: {
            terminal_sn: activateResult.data.terminal_sn,
            device_id: deviceId,
            activation_code: newActivationCode
          }
        });

      default:
        return Response.json({
          success: false,
          message: '不支持的操作类型'
        });
    }
  } catch (error) {
    log.error('收钱吧API GET请求失败', error as Error);
    return Response.json({
      success: false,
      message: '服务器内部错误',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 先获取原始文本，用于调试JSON解析错误
    const rawText = await req.text();
    log.info('收到POST请求原始内容', { rawText: rawText.substring(0, 200) });

    // 解析JSON
    let body;
    try {
      body = JSON.parse(rawText);
    } catch (parseError) {
      log.error('JSON解析失败', parseError as Error, {
        rawText: rawText.substring(0, 100),
        charCodes: Array.from(rawText.substring(0, 20)).map(c => c.charCodeAt(0))
      });
      return Response.json({
        success: false,
        message: 'JSON解析失败: ' + (parseError as Error).message,
        rawText: rawText.substring(0, 100)
      }, { status: 400 });
    }

    const { action } = body;

    log.info('收钱吧API请求', { action, timestamp: new Date().toISOString() });

    // 网络诊断
    if (action === 'diagnose') {
      const sqbResult = await diagnoseSQBConnection();
      const redisResult = await getRedisStatus();

      return Response.json({
        success: true,
        message: '网络诊断完成',
        data: {
          sqb: sqbResult,
          redis: redisResult,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 获取或激活终端
    if (action === 'get_or_activate_terminal') {
      try {
        // 1. 先尝试从缓存获取终端信息
        let terminalInfo = await getMainTerminalInfo();

        if (terminalInfo) {
          log.info('使用缓存的终端信息', {
            device_id: terminalInfo.device_id,
            terminal_sn: terminalInfo.terminal_sn
          });

          return Response.json({
            success: true,
            message: '使用缓存的终端信息',
            data: {
              terminalInfo,
              fromCache: true,
            },
          });
        }

        // 2. 缓存中没有，执行激活流程
        log.info('缓存中无终端信息，开始激活新终端...');
        const deviceId = generateDeviceId();

        const activateResult = await activateTerminal(deviceId, SQB_CONFIG.TEST_ACTIVATION_CODE);

        if (!activateResult.success) {
          return Response.json({
            success: false,
            message: `终端激活失败: ${activateResult.error || '未知错误'}`,
            data: activateResult,
          });
        }

        // 3. 解析激活结果
        const bizResponse = activateResult.data?.biz_response;
        if (!bizResponse?.terminal_sn || !bizResponse?.terminal_key) {
          return Response.json({
            success: false,
            message: '激活响应格式错误，缺少终端信息',
            data: activateResult.data,
          });
        }

        // 4. 构建终端信息并存储到缓存
        terminalInfo = {
          device_id: deviceId,
          terminal_sn: bizResponse.terminal_sn,
          terminal_key: bizResponse.terminal_key,
          created_at: new Date().toISOString(),
        };

        await storeMainTerminalInfo(terminalInfo);

        log.info('新终端激活成功并已缓存', {
          device_id: terminalInfo.device_id,
          terminal_sn: terminalInfo.terminal_sn
        });

        return Response.json({
          success: true,
          message: '终端激活成功',
          data: {
            terminalInfo,
            fromCache: false,
            activateData: activateResult.data,
          },
        });

      } catch (error) {
        log.error('获取或激活终端失败', error as Error);
        return Response.json({
          success: false,
          message: '获取或激活终端失败',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    // 智能签到（检查是否需要签到）
    if (action === 'smart_checkin') {
      try {
        // 1. 获取终端信息
        const terminalInfo = await getMainTerminalInfo();
        if (!terminalInfo) {
          return Response.json({
            success: false,
            message: '未找到终端信息，请先激活终端',
          });
        }

        // 2. 检查今日是否已签到
        const hasCheckedIn = await hasCheckedInToday();
        if (hasCheckedIn) {
          log.info('今日已签到，跳过签到流程');
          return Response.json({
            success: true,
            message: '今日已签到',
            data: {
              terminalInfo,
              alreadyCheckedIn: true,
            },
          });
        }

        // 3. 执行签到
        log.info('执行签到流程...');
        const checkinResult = await checkinTerminal(
          terminalInfo.terminal_sn,
          terminalInfo.terminal_key,
          terminalInfo.device_id
        );

        if (!checkinResult.success) {
          return Response.json({
            success: false,
            message: `签到失败: ${checkinResult.error || '未知错误'}`,
            data: checkinResult,
          });
        }

        // 4. 标记今日已签到
        await markCheckinToday(terminalInfo.device_id);

        log.info('签到成功');
        return Response.json({
          success: true,
          message: '签到成功',
          data: {
            terminalInfo,
            checkinData: checkinResult.data,
            alreadyCheckedIn: false,
          },
        });

      } catch (error) {
        log.error('智能签到失败', error as Error);
        return Response.json({
          success: false,
          message: '智能签到失败',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    // 创建支付订单
    if (action === 'create_payment') {
      try {
        const { amount, subject, payway } = body;

        // 参数验证
        if (!amount || amount <= 0) {
          return Response.json({
            success: false,
            message: '支付金额必须大于0',
          });
        }

        if (!subject) {
          return Response.json({
            success: false,
            message: '支付主题不能为空',
          });
        }

        if (!payway || !['2', '3'].includes(payway)) {
          return Response.json({
            success: false,
            message: '支付方式无效，必须是2(支付宝)或3(微信)',
          });
        }

        // 用户身份验证
        let userUuid: string;
        try {
          userUuid = await getUserUuid();
          if (!userUuid) {
            return Response.json({
              success: false,
              message: '用户未登录',
            });
          }
        } catch (error) {
          log.error('获取用户UUID失败', error as Error);
          return Response.json({
            success: false,
            message: '认证失败',
          }, { status: 401 });
        }

        // 1. 获取终端信息
        let terminalInfo = await getMainTerminalInfo();
        log.info('获取终端信息结果', {
          hasTerminalInfo: !!terminalInfo,
          terminalInfo: terminalInfo ? {
            terminal_sn: terminalInfo.terminal_sn,
            terminal_key: terminalInfo.terminal_key ? '***' + terminalInfo.terminal_key.slice(-4) : 'undefined',
            device_id: terminalInfo.device_id,
            activated_at: terminalInfo.activated_at,
            last_updated: terminalInfo.last_updated
          } : null
        });



        // 如果没有终端信息或终端信息无效，尝试重新激活
        if (!terminalInfo || !terminalInfo.terminal_sn || !terminalInfo.terminal_key ||
            terminalInfo.terminal_key === 'undefined') {
          log.warn('终端信息不存在或无效，尝试重新激活', {
            hasTerminalInfo: !!terminalInfo,
            terminal_sn: terminalInfo?.terminal_sn,
            terminal_key_valid: terminalInfo?.terminal_key && terminalInfo.terminal_key !== 'undefined'
          });

          try {
            // 先清除可能存在的无效缓存
            const { deleteTerminalInfo } = await import('@/lib/redis-cache');
            await deleteTerminalInfo('clear_cache');
            log.info('已清除无效的终端缓存');

            // 调用重新激活接口
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
            const reactivateResponse = await fetch(`${baseUrl}/api/sqb-reactivate`, {
              method: 'GET',
            });

            if (reactivateResponse.ok) {
              const reactivateResult = await reactivateResponse.json();
              log.info('终端重新激活成功', reactivateResult);

              // 重新获取终端信息
              terminalInfo = await getMainTerminalInfo();
              log.info('重新获取终端信息结果', {
                hasTerminalInfo: !!terminalInfo,
                terminalInfo: terminalInfo ? {
                  terminal_sn: terminalInfo.terminal_sn,
                  terminal_key: terminalInfo.terminal_key ? '***' + terminalInfo.terminal_key.slice(-4) : 'undefined',
                  device_id: terminalInfo.device_id,
                  activated_at: terminalInfo.activated_at
                } : null
              });
            } else {
              log.error('终端重新激活失败', undefined, { status: reactivateResponse.status });
            }
          } catch (error) {
            log.error('终端重新激活异常', error as Error);
          }
        }

        // 最终检查终端信息
        if (!terminalInfo) {
          return Response.json({
            success: false,
            message: '未找到终端信息，且自动激活失败，请联系管理员',
          });
        }

        // 2. 生成订单号和计算积分
        const clientSn = `WMZS_${getSnowId()}`;
        const amountInCents = Math.round(amount * 100); // 转换为分
        const creditsAmount = Math.round(amount * 100); // 1元=100积分
        const paywayName = payway === '2' ? '支付宝' : '微信';

        // 3. 创建支付订单
        log.info('创建支付订单参数', {
          terminal_sn: terminalInfo.terminal_sn,
          terminal_key: terminalInfo.terminal_key ? '***' + terminalInfo.terminal_key.slice(-4) : 'undefined',
          client_sn: clientSn,
          total_amount: amountInCents,
          subject,
          payway
        });

        const paymentResult = await createPayment(
          terminalInfo.terminal_sn,
          terminalInfo.terminal_key,
          {
            client_sn: clientSn,
            total_amount: amountInCents,
            subject,
            payway,
            operator: 'system',
          }
        );

        if (!paymentResult.success) {
          return Response.json({
            success: false,
            message: `创建支付订单失败: ${paymentResult.error || '未知错误'}`,
            data: paymentResult,
          });
        }

        // 4. 解析支付结果
        const bizResponse = paymentResult.data?.biz_response;
        const qrCode = bizResponse?.data?.qr_code || bizResponse?.qr_code || bizResponse?.pay_url;
        const qrCodeImageUrl = bizResponse?.data?.qr_code_image_url || bizResponse?.qr_code_image_url;

        if (!qrCode) {
          // 记录详细的响应信息用于调试
          log.warn('支付订单创建成功但未获取到二维码', {
            bizResponse,
            fullData: paymentResult.data
          });

          return Response.json({
            success: false,
            message: '支付订单创建失败，未获取到二维码',
            data: paymentResult.data,
          });
        }

        // 5. 保存订单到数据库
        const dbOrderData: Omit<SQBPaymentOrder, 'id' | 'created_at' | 'updated_at'> = {
          client_sn: clientSn,
          user_uuid: userUuid,
          total_amount: amountInCents,
          subject,
          description: `积分充值 - ${creditsAmount}积分`,
          payway,
          payway_name: paywayName,
          terminal_sn: terminalInfo.terminal_sn,
          device_id: terminalInfo.device_id,
          status: 'CREATED',
          qr_code: qrCode,
          qr_code_image_url: qrCodeImageUrl,
          credits_amount: creditsAmount,
          operator: 'system'
        };

        const dbOrder = await createPaymentOrder(dbOrderData);

        // 6. 缓存订单信息（保持兼容性）
        const orderData: PaymentOrderData = {
          client_sn: clientSn,
          device_id: terminalInfo.device_id,
          terminal_sn: terminalInfo.terminal_sn,
          amount: amountInCents,
          subject,
          payway,
          qr_code: qrCode,
        };

        await cachePaymentOrder(orderData);

        log.info('支付订单创建成功', {
          client_sn: clientSn,
          amount: amountInCents,
          credits: creditsAmount,
          user_uuid: userUuid
        });

        return Response.json({
          success: true,
          message: '支付订单创建成功',
          data: {
            client_sn: clientSn,
            qr_code: qrCode,
            qr_code_image_url: qrCodeImageUrl,
            amount: amountInCents,
            credits_amount: creditsAmount,
            subject,
            payway,
            payway_name: paywayName,
            expired_at: dbOrder.expired_at,
            paymentData: paymentResult.data,
          },
        });

      } catch (error) {
        log.error('创建支付订单失败', error as Error);
        return Response.json({
          success: false,
          message: '创建支付订单失败',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    // 查询支付状态
    if (action === 'query_payment') {
      try {
        const { client_sn } = body;

        if (!client_sn) {
          return Response.json({
            success: false,
            message: '订单号不能为空',
          });
        }

        // 1. 获取终端信息
        const terminalInfo = await getMainTerminalInfo();
        if (!terminalInfo) {
          return Response.json({
            success: false,
            message: '未找到终端信息',
          });
        }

        // 2. 查询支付状态
        const queryResult = await queryPayment(
          terminalInfo.terminal_sn,
          terminalInfo.terminal_key,
          client_sn
        );

        if (!queryResult.success) {
          return Response.json({
            success: false,
            message: `查询支付状态失败: ${queryResult.error || '未知错误'}`,
            data: queryResult,
          });
        }

        // 3. 获取缓存的订单信息
        const cachedOrder = await getCachedPaymentOrder(client_sn);

        return Response.json({
          success: true,
          message: '查询支付状态成功',
          data: {
            queryData: queryResult.data,
            cachedOrder,
          },
        });

      } catch (error) {
        log.error('查询支付状态失败', error as Error);
        return Response.json({
          success: false,
          message: '查询支付状态失败',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }



    // 获取支付结果详情（用于支付成功后获取准确的积分信息）
    if (action === 'get_payment_result') {
      try {
        const { client_sn } = body;

        if (!client_sn) {
          return Response.json({
            success: false,
            message: '缺少订单号参数'
          });
        }

        // 获取用户UUID
        const userUuid = await getUserUuid();
        if (!userUuid) {
          return Response.json({
            success: false,
            message: '用户未登录'
          }, { status: 401 });
        }

        // 从数据库获取订单信息
        const order = await getPaymentOrderByClientSn(client_sn);
        if (!order) {
          return Response.json({
            success: false,
            message: '订单不存在'
          });
        }

        // 验证订单所有者
        if (order.user_uuid !== userUuid) {
          return Response.json({
            success: false,
            message: '无权访问此订单'
          }, { status: 403 });
        }

        // 检查订单是否已支付成功
        if (order.status !== 'PAID' && order.status !== 'SUCCESS') {
          return Response.json({
            success: false,
            message: '订单尚未支付成功'
          });
        }

        // 获取用户当前积分
        const creditsResponse = await fetch(`${process.env.NEXT_PUBLIC_WEB_URL}/api/get-user-credits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || ''
          }
        });

        let currentCredits = 0;
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json();
          if (creditsData.code === 0) {
            currentCredits = creditsData.data.left_credits || 0;
          }
        }

        // 计算积分信息
        const chargedCredits = order.credits_amount || 0;
        const chargedAmount = (order.total_amount || 0) / 100;
        const previousCredits = Math.max(0, currentCredits - chargedCredits);

        return Response.json({
          success: true,
          message: '获取支付结果成功',
          data: {
            charged_amount: chargedAmount,
            charged_credits: chargedCredits,
            previous_credits: previousCredits,
            current_credits: currentCredits,
            order_info: {
              client_sn: order.client_sn,
              status: order.status,
              finish_time: order.finish_time,
              trade_no: order.trade_no
            }
          }
        });

      } catch (error) {
        log.error('获取支付结果失败', error as Error);
        return Response.json({
          success: false,
          message: '获取支付结果失败',
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    return Response.json({
      success: false,
      message: '不支持的操作',
    });

  } catch (error) {
    log.error('收钱吧API异常', error as Error);
    return Response.json({
      success: false,
      message: '服务器错误',
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}
