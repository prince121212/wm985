import { Order } from "@/types/order";
import { getSupabaseClient } from "@/models/db";

export enum OrderStatus {
  Created = "created",
  Paid = "paid",
  Deleted = "deleted",
}

export async function insertOrder(order: Order) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("orders").insert(order);

  if (error) {
    throw error;
  }

  return data;
}

export async function findOrderByOrderNo(
  order_no: string
): Promise<Order | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_no", order_no)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

export async function getFirstPaidOrderByUserUuid(
  user_uuid: string
): Promise<Order | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_uuid", user_uuid)
    .eq("status", "paid")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

export async function getFirstPaidOrderByUserEmail(
  user_email: string
): Promise<Order | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_email", user_email)
    .eq("status", "paid")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

export async function updateOrderStatus(
  order_no: string,
  status: string,
  paid_at: string,
  paid_email: string,
  paid_detail: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status, paid_at, paid_detail, paid_email })
    .eq("order_no", order_no);

  if (error) {
    throw error;
  }

  return data;
}

export async function updateOrderSession(
  order_no: string,
  stripe_session_id: string,
  order_detail: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ stripe_session_id, order_detail })
    .eq("order_no", order_no);

  if (error) {
    throw error;
  }

  return data;
}

export async function updateOrderSubscription(
  order_no: string,
  sub_id: string,
  sub_interval_count: number,
  sub_cycle_anchor: number,
  sub_period_end: number,
  sub_period_start: number,
  status: string,
  paid_at: string,
  sub_times: number,
  paid_email: string,
  paid_detail: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      sub_id,
      sub_interval_count,
      sub_cycle_anchor,
      sub_period_end,
      sub_period_start,
      status,
      paid_at,
      sub_times,
      paid_email,
      paid_detail,
    })
    .eq("order_no", order_no);

  if (error) {
    throw error;
  }

  return data;
}

export async function getOrdersByUserUuid(
  user_uuid: string
): Promise<Order[] | undefined> {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_uuid", user_uuid)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  // .gte("expired_at", now);

  if (error) {
    return undefined;
  }

  return data;
}

export async function getOrdersByUserEmail(
  user_email: string
): Promise<Order[] | undefined> {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_email", user_email)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  // .gte("expired_at", now);

  if (error) {
    return undefined;
  }

  return data;
}

export async function getOrdersByPaidEmail(
  paid_email: string
): Promise<Order[] | undefined> {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("paid_email", paid_email)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  // .gte("expired_at", now);

  if (error) {
    return undefined;
  }

  return data;
}

export async function getPaiedOrders(
  page: number,
  limit: number
): Promise<Order[] | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit);

  if (error) {
    return undefined;
  }

  return data;
}

// SQB支付订单接口定义
export interface SQBPaidOrderForAdmin {
  client_sn: string;
  user_email: string;
  user_nickname?: string;
  subject: string;
  total_amount: number;
  amount_yuan: string;
  payway: string;
  payway_display: string;
  status: string;
  status_display: string;
  credits_amount?: number;
  created_at: string;
  finish_time?: string;
  verification_status?: string;
  verification_status_display?: string;
  verification_time?: string;
  verification_error?: string;
}

/**
 * 获取SQB支付成功的订单列表（管理员用）
 */
export async function getSQBPaidOrders(
  page: number,
  limit: number,
  status?: string,
  verificationStatus?: string
): Promise<{ orders: SQBPaidOrderForAdmin[]; total: number } | undefined> {
  // 直接使用备用方案，不再尝试调用不存在的RPC函数
  return await getSQBPaidOrdersFallback(page, limit, status, verificationStatus);
}

/**
 * 备用方案：分别查询两个表然后合并数据
 */
async function getSQBPaidOrdersFallback(
  page: number,
  limit: number,
  status?: string,
  verificationStatus?: string
): Promise<{ orders: SQBPaidOrderForAdmin[]; total: number } | undefined> {
  const supabase = getSupabaseClient();

  try {
    // 1. 先获取总数
    let countQuery = supabase
      .from("sqb_payment_orders")
      .select('*', { count: 'exact', head: true });

    // 如果指定了支付状态筛选，添加筛选条件
    if (status) {
      countQuery = countQuery.eq("status", status);
    }

    // 如果指定了核验状态筛选，添加筛选条件
    if (verificationStatus) {
      countQuery = countQuery.eq("verification_status", verificationStatus);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('查询支付订单总数失败:', countError);
      return undefined;
    }

    const total = count || 0;

    // 2. 查询支付订单
    let ordersQuery = supabase
      .from("sqb_payment_orders")
      .select(`
        client_sn,
        user_uuid,
        subject,
        total_amount,
        payway,
        payway_name,
        status,
        credits_amount,
        created_at,
        finish_time,
        verification_status,
        verification_time,
        verification_error
      `);

    // 如果指定了支付状态筛选，添加筛选条件
    if (status) {
      ordersQuery = ordersQuery.eq("status", status);
    }

    // 如果指定了核验状态筛选，添加筛选条件
    if (verificationStatus) {
      ordersQuery = ordersQuery.eq("verification_status", verificationStatus);
    }

    const { data: orders, error: ordersError } = await ordersQuery
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (ordersError) {
      console.error('查询支付订单失败:', ordersError);
      return undefined;
    }

    if (!orders || orders.length === 0) {
      return { orders: [], total };
    }

    // 3. 获取所有用户UUID
    const userUuids = orders.map(order => order.user_uuid);

    // 4. 查询用户信息
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("uuid, email, nickname")
      .in("uuid", userUuids);

    if (usersError) {
      console.error('查询用户信息失败:', usersError);
      // 即使用户查询失败，也返回订单数据，只是用户信息为空
    }

    // 5. 创建用户信息映射
    const userMap = new Map();
    if (users) {
      users.forEach(user => {
        userMap.set(user.uuid, user);
      });
    }

    // 6. 合并数据
    const processedOrders = orders.map((order: any) => {
      const user = userMap.get(order.user_uuid);

      // 支付方式映射
      let payway_display = order.payway_name || '未知';
      if (order.payway === '2') payway_display = '支付宝';
      else if (order.payway === '3') payway_display = '微信支付';

      // 状态映射
      let status_display = '未知';
      if (order.status === 'SUCCESS') status_display = '支付成功';
      else if (order.status === 'CREATED') status_display = '待支付';
      else if (order.status === 'CANCELLED') status_display = '已取消';
      else if (order.status === 'FAILED') status_display = '支付失败';

      // 核验状态映射
      const verification_status = order.verification_status || 'UNVERIFIED';
      let verification_status_display = '未核验';
      if (verification_status === 'VERIFIED_CORRECT') verification_status_display = '核验正确';
      else if (verification_status === 'VERIFIED_ERROR') verification_status_display = '核验错误';
      else if (verification_status === 'VERIFICATION_FAILED') verification_status_display = '核验失败';

      return {
        client_sn: order.client_sn,
        user_email: user?.email || '未知用户',
        user_nickname: user?.nickname,
        subject: order.subject,
        total_amount: order.total_amount,
        amount_yuan: `¥${(order.total_amount / 100).toFixed(2)}`,
        payway: order.payway,
        payway_display,
        status: order.status,
        status_display,
        credits_amount: order.credits_amount,
        created_at: order.created_at,
        finish_time: order.finish_time,
        verification_status: verification_status,
        verification_status_display,
        verification_time: order.verification_time,
        verification_error: order.verification_error
      };
    });

    return { orders: processedOrders, total };

  } catch (error) {
    console.error('获取SQB支付订单失败:', error);
    return undefined;
  }
}
