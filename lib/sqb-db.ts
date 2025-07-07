import { getSupabaseClient, withRetry } from '../models/db';
import { log } from './logger';
import { getSnowId } from './hash';

// 支付订单接口
export interface SQBPaymentOrder {
  id?: number;
  client_sn: string;
  sn?: string;
  trade_no?: string;
  user_uuid: string;
  total_amount: number;
  net_amount?: number;
  subject: string;
  description?: string;
  payway: string;
  payway_name?: string;
  terminal_sn: string;
  device_id: string;
  status: 'CREATED' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PAID' | 'REFUNDED' | 'PARTIAL_REFUNDED' | 'REFUND_INPROGRESS' | 'REFUND_ERROR';
  order_status?: string;
  payer_uid?: string;
  payer_login?: string;
  qr_code?: string;
  qr_code_image_url?: string;
  created_at?: Date;
  updated_at?: Date;
  finish_time?: Date;
  channel_finish_time?: Date;
  expired_at?: Date;
  notify_processed?: boolean;
  notify_processed_at?: Date;
  credits_amount?: number;
  credits_processed?: boolean;
  credits_processed_at?: Date;
  credits_trans_no?: string;
  operator?: string;
  remark?: string;
  verification_status?: string;
  verification_time?: Date;
  verification_error?: string;
  refund_amount?: number;
  refund_count?: number;
}

// 退款记录接口
export interface SQBRefund {
  id?: number;
  client_sn: string;
  refund_request_no: string;
  refund_amount: number;
  refund_reason?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  operator: string;
  created_at?: Date;
  updated_at?: Date;
  finish_time?: Date;
  channel_finish_time?: Date;
  sqb_response?: any;
  error_message?: string;
  sn?: string;
  trade_no?: string;
  settlement_amount?: number;
  net_amount?: number;
}

// 支付回调日志接口
export interface SQBPaymentCallback {
  id?: number;
  client_sn: string;
  callback_data: any;
  signature?: string;
  signature_verified?: boolean;
  signature_error?: string;
  processed?: boolean;
  processed_at?: Date;
  error_message?: string;
  created_at?: Date;
}

/**
 * 创建支付订单
 */
export async function createPaymentOrder(orderData: Omit<SQBPaymentOrder, 'id' | 'created_at' | 'updated_at'>): Promise<SQBPaymentOrder> {
  return withRetry(async () => {
    try {
      // 设置订单过期时间（4分钟后）
      const expiredAt = new Date(Date.now() + 4 * 60 * 1000);

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_payment_orders')
        .insert({
          client_sn: orderData.client_sn,
          user_uuid: orderData.user_uuid,
          total_amount: orderData.total_amount,
          subject: orderData.subject,
          description: orderData.description || orderData.subject,
          payway: orderData.payway,
          payway_name: orderData.payway_name,
          terminal_sn: orderData.terminal_sn,
          device_id: orderData.device_id,
          status: orderData.status || 'CREATED',
          qr_code: orderData.qr_code,
          qr_code_image_url: orderData.qr_code_image_url,
          expired_at: expiredAt.toISOString(),
          operator: orderData.operator || 'system',
          credits_amount: orderData.credits_amount
        })
        .select()
        .single();

      if (error) {
        log.error('创建支付订单失败', error);
        throw error;
      }

      log.info('支付订单已创建', {
        client_sn: orderData.client_sn,
        user_uuid: orderData.user_uuid,
        amount: orderData.total_amount
      });

      return data;
    } catch (error) {
      log.error('创建支付订单失败', error as Error);
      throw error;
    }
  });
}

/**
 * 根据订单号获取支付订单
 */
export async function getPaymentOrderByClientSn(clientSn: string): Promise<SQBPaymentOrder | null> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_payment_orders')
        .select('*')
        .eq('client_sn', clientSn)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 记录未找到，返回null
          return null;
        }
        log.error('获取支付订单失败', error);
        throw error;
      }

      return data;
    } catch (error) {
      log.error('获取支付订单失败', error as Error);
      throw error;
    }
  });
}

/**
 * 更新支付订单状态
 */
export async function updatePaymentOrderStatus(
  clientSn: string,
  updateData: Partial<SQBPaymentOrder>
): Promise<SQBPaymentOrder | null> {
  return withRetry(async () => {
    try {
      if (Object.keys(updateData).length === 0) {
        throw new Error('没有要更新的字段');
      }

      const supabase = getSupabaseClient();

      // 准备更新数据，添加更新时间
      const updatePayload = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sqb_payment_orders')
        .update(updatePayload)
        .eq('client_sn', clientSn)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          log.warn('支付订单不存在', { client_sn: clientSn });
          return null;
        }
        log.error('更新支付订单状态失败', error);
        throw error;
      }

      log.info('支付订单状态已更新', {
        client_sn: clientSn,
        updated_fields: Object.keys(updateData)
      });

      return data;
    } catch (error) {
      log.error('更新支付订单状态失败', error as Error);
      throw error;
    }
  });
}

/**
 * 记录支付回调日志
 */
export async function logPaymentCallback(callbackData: Omit<SQBPaymentCallback, 'id' | 'created_at'>): Promise<SQBPaymentCallback> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('sqb_payment_callbacks')
        .insert({
          client_sn: callbackData.client_sn,
          callback_data: callbackData.callback_data,
          signature: callbackData.signature,
          signature_verified: callbackData.signature_verified || false,
          signature_error: callbackData.signature_error,
          processed: callbackData.processed || false,
          error_message: callbackData.error_message,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        log.error('记录支付回调日志失败', error);
        throw error;
      }

      log.info('支付回调日志已记录', {
        client_sn: callbackData.client_sn,
        signature_verified: callbackData.signature_verified,
        processed: callbackData.processed
      });

      return data;
    } catch (error) {
      log.error('记录支付回调日志失败', error as Error);
      throw error;
    }
  });
}

/**
 * 处理支付成功后的积分充值（使用数据库事务确保原子性）
 */
export async function processPaymentCredits(
  clientSn: string,
  userUuid: string,
  creditsAmount: number
): Promise<{ success: boolean; transNo?: string; error?: string; already_processed?: boolean }> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    try {
      // 使用数据库事务确保原子性
      const { data, error } = await supabase.rpc('process_payment_credits_transaction', {
        p_client_sn: clientSn,
        p_user_uuid: userUuid,
        p_credits_amount: creditsAmount,
        p_trans_no: `SQB_${getSnowId()}`
      });

      if (error) {
        // 如果RPC函数不存在，回退到手动事务处理
        if (error.code === '42883') { // function does not exist
          log.warn('RPC函数不存在，使用手动事务处理', { client_sn: clientSn });
          return await processPaymentCreditsManual(clientSn, userUuid, creditsAmount);
        }
        throw error;
      }

      const result = data as { success: boolean; trans_no?: string; already_processed?: boolean; error?: string };

      if (result.success) {
        log.info('支付积分充值处理完成', {
          client_sn: clientSn,
          user_uuid: userUuid,
          credits: creditsAmount,
          trans_no: result.trans_no,
          already_processed: result.already_processed
        });
      }

      return result;

    } catch (error) {
      log.error('处理支付积分充值失败', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  });
}

/**
 * 手动事务处理积分充值（当RPC函数不可用时的回退方案）
 */
async function processPaymentCreditsManual(
  clientSn: string,
  userUuid: string,
  creditsAmount: number
): Promise<{ success: boolean; transNo?: string; error?: string; already_processed?: boolean }> {
  const supabase = getSupabaseClient();

  try {
    // 1. 检查订单是否已经处理过积分
    const { data: order, error: orderError } = await supabase
      .from('sqb_payment_orders')
      .select('credits_processed, credits_trans_no')
      .eq('client_sn', clientSn)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        throw new Error('支付订单不存在');
      }
      throw orderError;
    }

    if (order.credits_processed) {
      log.warn('积分已处理过，跳过重复处理', {
        client_sn: clientSn,
        trans_no: order.credits_trans_no
      });
      return { success: true, transNo: order.credits_trans_no, already_processed: true };
    }

    // 2. 生成积分交易号
    const transNo = `SQB_${getSnowId()}`;
    const now = new Date().toISOString();

    // 3. 使用批量操作模拟事务（Supabase的限制）
    // 先插入积分记录
    const { error: creditsError } = await supabase
      .from('credits')
      .insert({
        trans_no: transNo,
        user_uuid: userUuid,
        trans_type: 'RECHARGE',
        credits: creditsAmount,
        order_no: clientSn,
        payment_method: 'SQB',
        payment_order_sn: clientSn,
        created_at: now
      });

    if (creditsError) {
      throw creditsError;
    }

    // 4. 更新支付订单的积分处理状态
    const { error: updateOrderError } = await supabase
      .from('sqb_payment_orders')
      .update({
        credits_amount: creditsAmount,
        credits_processed: true,
        credits_processed_at: now,
        credits_trans_no: transNo,
        updated_at: now
      })
      .eq('client_sn', clientSn)
      .eq('credits_processed', false); // 添加条件防止重复处理

    if (updateOrderError) {
      // 如果更新订单失败，尝试回滚积分记录
      try {
        await supabase
          .from('credits')
          .delete()
          .eq('trans_no', transNo);
      } catch (rollbackError) {
        log.error('回滚积分记录失败', rollbackError as Error, { trans_no: transNo });
      }
      throw updateOrderError;
    }

    log.info('支付积分充值处理完成（手动事务）', {
      client_sn: clientSn,
      user_uuid: userUuid,
      credits: creditsAmount,
      trans_no: transNo
    });

    return { success: true, transNo, already_processed: false };

  } catch (error) {
    log.error('手动处理支付积分充值失败', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 获取用户的支付订单列表
 */
export async function getUserPaymentOrders(
  userUuid: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ orders: SQBPaymentOrder[]; total: number }> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();

      // 先自动取消过期的待支付订单（4分钟前创建的CREATED状态订单）
      const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
      const { data: expiredOrders, error: expiredError } = await supabase
        .from('sqb_payment_orders')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('user_uuid', userUuid)
        .eq('status', 'CREATED')
        .lt('created_at', fourMinutesAgo.toISOString())
        .select('client_sn');

      if (expiredError) {
        log.error('自动取消过期订单失败', expiredError);
        // 不抛出错误，继续执行查询
      } else if (expiredOrders && expiredOrders.length > 0) {
        log.info('自动取消过期订单', {
          user_uuid: userUuid,
          cancelled_count: expiredOrders.length,
          cancelled_orders: expiredOrders.map(o => o.client_sn)
        });
      }

      // 获取总数
      const { count, error: countError } = await supabase
        .from('sqb_payment_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_uuid', userUuid);

      if (countError) {
        throw countError;
      }

      // 获取订单列表
      const { data: orders, error: ordersError } = await supabase
        .from('sqb_payment_orders')
        .select('*')
        .eq('user_uuid', userUuid)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (ordersError) {
        throw ordersError;
      }

      return {
        orders: orders || [],
        total: count || 0
      };
    } catch (error) {
      log.error('获取用户支付订单列表失败', error as Error);
      throw error;
    }
  });
}

/**
 * 获取需要核验的订单列表
 */
export async function getOrdersNeedingVerification(): Promise<SQBPaymentOrder[]> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_payment_orders')
        .select('*')
        .in('verification_status', ['UNVERIFIED', 'VERIFICATION_FAILED', 'VERIFIED_ERROR'])
        .order('created_at', { ascending: true });

      if (error) {
        log.error('获取需要核验的订单失败', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      log.error('获取需要核验的订单异常', error as Error);
      throw error;
    }
  });
}

/**
 * 更新订单核验状态
 */
export async function updateOrderVerificationStatus(
  clientSn: string,
  verificationStatus: string,
  verificationError?: string
): Promise<SQBPaymentOrder | null> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_payment_orders')
        .update({
          verification_status: verificationStatus,
          verification_time: new Date().toISOString(),
          verification_error: verificationError || null,
          updated_at: new Date().toISOString()
        })
        .eq('client_sn', clientSn)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          log.warn('订单不存在', { client_sn: clientSn });
          return null;
        }
        log.error('更新订单核验状态失败', error);
        throw error;
      }

      log.info('订单核验状态更新成功', {
        client_sn: clientSn,
        verification_status: verificationStatus,
        has_error: !!verificationError
      });
      return data;
    } catch (error) {
      log.error('更新订单核验状态异常', error as Error);
      throw error;
    }
  });
}

/**
 * 创建退款记录
 */
export async function createRefundRecord(refundData: Omit<SQBRefund, 'id' | 'created_at' | 'updated_at'>): Promise<SQBRefund> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_refunds')
        .insert({
          client_sn: refundData.client_sn,
          refund_request_no: refundData.refund_request_no,
          refund_amount: refundData.refund_amount,
          refund_reason: refundData.refund_reason,
          status: refundData.status,
          operator: refundData.operator,
          sqb_response: refundData.sqb_response,
          error_message: refundData.error_message,
          sn: refundData.sn,
          trade_no: refundData.trade_no,
          settlement_amount: refundData.settlement_amount,
          net_amount: refundData.net_amount
        })
        .select()
        .single();

      if (error) {
        log.error('创建退款记录失败', error);
        throw error;
      }

      log.info('退款记录已创建', {
        client_sn: refundData.client_sn,
        refund_request_no: refundData.refund_request_no,
        refund_amount: refundData.refund_amount
      });

      return data;
    } catch (error) {
      log.error('创建退款记录失败', error as Error);
      throw error;
    }
  });
}

/**
 * 更新退款记录状态
 */
export async function updateRefundRecord(
  refundRequestNo: string,
  updateData: Partial<Pick<SQBRefund, 'status' | 'finish_time' | 'channel_finish_time' | 'sqb_response' | 'error_message' | 'sn' | 'trade_no' | 'settlement_amount' | 'net_amount'>>
): Promise<SQBRefund | null> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_refunds')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('refund_request_no', refundRequestNo)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        log.error('更新退款记录失败', error);
        throw error;
      }

      log.info('退款记录已更新', {
        refund_request_no: refundRequestNo,
        status: updateData.status
      });

      return data;
    } catch (error) {
      log.error('更新退款记录失败', error as Error);
      throw error;
    }
  });
}

/**
 * 获取订单的退款记录列表
 */
export async function getRefundsByOrderSn(clientSn: string): Promise<SQBRefund[]> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sqb_refunds')
        .select('*')
        .eq('client_sn', clientSn)
        .order('created_at', { ascending: false });

      if (error) {
        log.error('获取退款记录失败', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      log.error('获取退款记录失败', error as Error);
      throw error;
    }
  });
}

/**
 * 更新订单退款信息
 */
export async function updateOrderRefundInfo(
  clientSn: string,
  refundAmount: number,
  refundCount: number,
  newStatus?: string
): Promise<SQBPaymentOrder | null> {
  return withRetry(async () => {
    try {
      const supabase = getSupabaseClient();

      const updateData: any = {
        refund_amount: refundAmount,
        refund_count: refundCount,
        updated_at: new Date().toISOString()
      };

      // 如果提供了新状态，则更新状态
      if (newStatus) {
        updateData.status = newStatus;
      }

      const { data, error } = await supabase
        .from('sqb_payment_orders')
        .update(updateData)
        .eq('client_sn', clientSn)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        log.error('更新订单退款信息失败', error);
        throw error;
      }

      log.info('订单退款信息已更新', {
        client_sn: clientSn,
        refund_amount: refundAmount,
        refund_count: refundCount,
        new_status: newStatus
      });

      return data;
    } catch (error) {
      log.error('更新订单退款信息失败', error as Error);
      throw error;
    }
  });
}

/**
 * 使用数据库事务处理退款操作（推荐使用）
 */
export async function processRefundTransaction(
  clientSn: string,
  refundRequestNo: string,
  refundAmount: number,
  refundData?: {
    newStatus?: string;
    finishTime?: Date;
    channelFinishTime?: Date;
    sqbResponse?: any;
    sn?: string;
    tradeNo?: string;
    settlementAmount?: number;
    netAmount?: number;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    try {
      // 使用数据库RPC函数确保事务原子性
      const { data, error } = await supabase.rpc('process_refund_transaction', {
        p_client_sn: clientSn,
        p_refund_request_no: refundRequestNo,
        p_refund_amount: refundAmount,
        p_new_status: refundData?.newStatus || null,
        p_finish_time: refundData?.finishTime?.toISOString() || null,
        p_channel_finish_time: refundData?.channelFinishTime?.toISOString() || null,
        p_sqb_response: refundData?.sqbResponse || null,
        p_sn: refundData?.sn || null,
        p_trade_no: refundData?.tradeNo || null,
        p_settlement_amount: refundData?.settlementAmount || null,
        p_net_amount: refundData?.netAmount || null
      });

      if (error) {
        // 如果RPC函数不存在，回退到手动事务处理
        if (error.code === '42883') { // function does not exist
          log.warn('RPC函数不存在，使用手动事务处理', { client_sn: clientSn });
          return await processRefundTransactionManual(clientSn, refundRequestNo, refundAmount, refundData);
        }
        throw error;
      }

      const result = data as { success: boolean; error?: string; [key: string]: any };

      if (result.success) {
        log.info('退款事务处理完成', {
          client_sn: clientSn,
          refund_request_no: refundRequestNo,
          refund_amount: refundAmount,
          new_order_status: result.new_order_status,
          remaining_amount: result.remaining_amount
        });
      } else {
        log.error('退款事务处理失败', new Error(result.error || '未知错误'), {
          client_sn: clientSn,
          refund_request_no: refundRequestNo
        });
      }

      return result;

    } catch (error) {
      log.error('退款事务处理异常', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  });
}

/**
 * 手动事务处理退款（当RPC函数不可用时的回退方案）
 */
async function processRefundTransactionManual(
  clientSn: string,
  refundRequestNo: string,
  refundAmount: number,
  refundData?: {
    newStatus?: string;
    finishTime?: Date;
    channelFinishTime?: Date;
    sqbResponse?: any;
    sn?: string;
    tradeNo?: string;
    settlementAmount?: number;
    netAmount?: number;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    // 1. 获取并锁定订单记录（模拟FOR UPDATE）
    const { data: order, error: orderError } = await supabase
      .from('sqb_payment_orders')
      .select('total_amount, refund_amount, refund_count, status')
      .eq('client_sn', clientSn)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return { success: false, error: '订单不存在' };
      }
      throw orderError;
    }

    // 2. 计算新的退款金额和次数
    const currentRefundAmount = order.refund_amount || 0;
    const currentRefundCount = order.refund_count || 0;
    const newRefundAmount = currentRefundAmount + refundAmount;
    const newRefundCount = currentRefundCount + 1;

    // 3. 验证退款金额
    if (newRefundAmount > order.total_amount) {
      return { success: false, error: '退款金额超过订单总金额' };
    }

    // 4. 确定新的订单状态
    let newOrderStatus = refundData?.newStatus;
    if (!newOrderStatus) {
      newOrderStatus = newRefundAmount >= order.total_amount ? 'REFUNDED' : 'PARTIAL_REFUNDED';
    }

    // 5. 更新退款记录
    const { error: updateRefundError } = await supabase
      .from('sqb_refunds')
      .update({
        status: 'SUCCESS',
        finish_time: refundData?.finishTime?.toISOString() || new Date().toISOString(),
        channel_finish_time: refundData?.channelFinishTime?.toISOString(),
        sqb_response: refundData?.sqbResponse,
        sn: refundData?.sn,
        trade_no: refundData?.tradeNo,
        settlement_amount: refundData?.settlementAmount,
        net_amount: refundData?.netAmount,
        updated_at: new Date().toISOString()
      })
      .eq('refund_request_no', refundRequestNo);

    if (updateRefundError) {
      throw updateRefundError;
    }

    // 6. 更新订单退款信息
    const { error: updateOrderError } = await supabase
      .from('sqb_payment_orders')
      .update({
        refund_amount: newRefundAmount,
        refund_count: newRefundCount,
        status: newOrderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('client_sn', clientSn)
      .eq('refund_amount', currentRefundAmount) // 添加条件防止并发修改
      .eq('refund_count', currentRefundCount);

    if (updateOrderError) {
      // 如果更新订单失败，尝试回滚退款记录
      try {
        await supabase
          .from('sqb_refunds')
          .update({
            status: 'FAILED',
            error_message: '订单更新失败，事务回滚',
            updated_at: new Date().toISOString()
          })
          .eq('refund_request_no', refundRequestNo);
      } catch (rollbackError) {
        log.error('回滚退款记录失败', rollbackError as Error, { refund_request_no: refundRequestNo });
      }
      throw updateOrderError;
    }

    const result = {
      success: true,
      data: {
        new_refund_amount: newRefundAmount,
        new_refund_count: newRefundCount,
        new_order_status: newOrderStatus,
        remaining_amount: order.total_amount - newRefundAmount
      }
    };

    log.info('退款事务处理完成（手动事务）', {
      client_sn: clientSn,
      refund_request_no: refundRequestNo,
      refund_amount: refundAmount,
      new_order_status: newOrderStatus
    });

    return result;

  } catch (error) {
    log.error('手动退款事务处理失败', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}
