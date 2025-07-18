/**
 * 收钱吧支付系统常量定义
 * 如果未支付，订单创建 4分钟后状态变为PAY_ERROR
 * 6分钟后变为PAY_CANCELED 失败已撤单
 * 估计1小时后就查不到了
 * 刚创建未扫码的时候，这个订单是无法被查询到的 如果直到过期都没人扫码，会永远无法查询
 * 按照目前的收钱吧机制 185秒内没有扫码就会导致订单号不存在[EG11]
 * 以上是微信支付 以下是支付宝支付
 * 支付宝创建订单就有记录
 */

// 订单状态枚举
export const SQB_ORDER_STATUS = {
  CREATED: 'CREATED',                    // 订单已创建/支付中
  PAID: 'PAID',                         // 订单支付成功
  PAY_CANCELED: 'PAY_CANCELED',         // 支付失败并且已经成功充正 失败已撤单
  PAY_ERROR: 'PAY_ERROR',               // 支付异常，不确定是否已经成功充正,请联系收钱吧客服确认是否支付成功
  REFUNDED: 'REFUNDED',                 // 已成功全额退款
  PARTIAL_REFUNDED: 'PARTIAL_REFUNDED', // 已成功部分退款
  REFUND_INPROGRESS: 'REFUND_INPROGRESS', // 退款进行中
  REFUND_ERROR: 'REFUND_ERROR',         // 退款异常并且不确定第三方支付通道的最终退款状态
  CANCELED: 'CANCELED',                 // 客户端发起的撤单已成功
  CANCEL_ERROR: 'CANCEL_ERROR',         // 客户端发起的撤单异常并且不确定第三方支付通道的最终状态
  CANCEL_INPROGRESS: 'CANCEL_INPROGRESS', // 撤单进行中
  INVALID_STATUS_CODE: 'INVALID_STATUS_CODE' // 无效的状态码
} as const;

// 订单状态类型
export type SQBOrderStatus = typeof SQB_ORDER_STATUS[keyof typeof SQB_ORDER_STATUS];

// 订单状态描述映射
export const SQB_ORDER_STATUS_MESSAGES = {
  [SQB_ORDER_STATUS.CREATED]: '订单已创建，等待支付',
  [SQB_ORDER_STATUS.PAID]: '支付成功',
  [SQB_ORDER_STATUS.PAY_CANCELED]: '支付失败',
  [SQB_ORDER_STATUS.PAY_ERROR]: '支付异常，请联系客服确认',
  [SQB_ORDER_STATUS.REFUNDED]: '已全额退款',
  [SQB_ORDER_STATUS.PARTIAL_REFUNDED]: '已部分退款',
  [SQB_ORDER_STATUS.REFUND_INPROGRESS]: '退款处理中',
  [SQB_ORDER_STATUS.REFUND_ERROR]: '退款异常，请联系客服',
  [SQB_ORDER_STATUS.CANCELED]: '订单已取消',
  [SQB_ORDER_STATUS.CANCEL_ERROR]: '取消订单异常，请联系客服',
  [SQB_ORDER_STATUS.CANCEL_INPROGRESS]: '取消订单处理中',
  [SQB_ORDER_STATUS.INVALID_STATUS_CODE]: '无效的状态码'
} as const;

// 需要停止轮询的最终状态
export const FINAL_ORDER_STATUSES = [
  SQB_ORDER_STATUS.PAID,           // 支付成功
  SQB_ORDER_STATUS.PAY_CANCELED,   // 支付失败
  SQB_ORDER_STATUS.PAY_ERROR,      // 支付异常
  SQB_ORDER_STATUS.REFUNDED,       // 已退款
  SQB_ORDER_STATUS.PARTIAL_REFUNDED, // 部分退款
  SQB_ORDER_STATUS.CANCELED,       // 已取消
  SQB_ORDER_STATUS.CANCEL_ERROR,   // 取消异常
  SQB_ORDER_STATUS.INVALID_STATUS_CODE // 无效状态
] as const;

// 成功状态（需要处理积分充值的状态）
export const SUCCESS_ORDER_STATUSES = [
  SQB_ORDER_STATUS.PAID
] as const;

// 失败状态（需要提示用户的失败状态）
export const FAILED_ORDER_STATUSES = [
  SQB_ORDER_STATUS.PAY_CANCELED,
  SQB_ORDER_STATUS.PAY_ERROR,
  SQB_ORDER_STATUS.CANCELED,
  SQB_ORDER_STATUS.CANCEL_ERROR,
  SQB_ORDER_STATUS.INVALID_STATUS_CODE
] as const;

// 进行中状态（需要继续轮询的状态）
export const PENDING_ORDER_STATUSES = [
  SQB_ORDER_STATUS.CREATED,
  SQB_ORDER_STATUS.REFUND_INPROGRESS,
  SQB_ORDER_STATUS.CANCEL_INPROGRESS
] as const;

// 支付方式代码
export const SQB_PAYMENT_METHODS = {
  ALIPAY: '2',    // 支付宝
  WECHAT: '3'     // 微信支付
} as const;

// 支付方式名称映射
export const SQB_PAYMENT_METHOD_NAMES = {
  [SQB_PAYMENT_METHODS.ALIPAY]: '支付宝',
  [SQB_PAYMENT_METHODS.WECHAT]: '微信支付'
} as const;

/**
 * 判断订单状态是否为最终状态（需要停止轮询）
 */
export function isFinalOrderStatus(status: string): boolean {
  return FINAL_ORDER_STATUSES.includes(status as any);
}

/**
 * 判断订单状态是否为成功状态
 */
export function isSuccessOrderStatus(status: string): boolean {
  return SUCCESS_ORDER_STATUSES.includes(status as any);
}

/**
 * 判断订单状态是否为失败状态
 */
export function isFailedOrderStatus(status: string): boolean {
  return FAILED_ORDER_STATUSES.includes(status as any);
}

/**
 * 判断订单状态是否为进行中状态
 */
export function isPendingOrderStatus(status: string): boolean {
  return PENDING_ORDER_STATUSES.includes(status as any);
}

/**
 * 获取订单状态的用户友好描述
 */
export function getOrderStatusMessage(status: string): string {
  return SQB_ORDER_STATUS_MESSAGES[status as SQBOrderStatus] || '未知状态';
}

// 核验状态枚举
export const VERIFICATION_STATUS = {
  UNVERIFIED: 'UNVERIFIED',           // 未核验
  VERIFIED_CORRECT: 'VERIFIED_CORRECT', // 核验正确
  VERIFIED_ERROR: 'VERIFIED_ERROR',     // 核验错误
  VERIFICATION_FAILED: 'VERIFICATION_FAILED' // 核验失败
} as const;

// 核验状态类型
export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

// 核验状态描述映射
export const VERIFICATION_STATUS_MESSAGES = {
  [VERIFICATION_STATUS.UNVERIFIED]: '未核验',
  [VERIFICATION_STATUS.VERIFIED_CORRECT]: '核验正确',
  [VERIFICATION_STATUS.VERIFIED_ERROR]: '核验错误',
  [VERIFICATION_STATUS.VERIFICATION_FAILED]: '核验失败'
} as const;

/**
 * 获取核验状态的用户友好描述
 */
export function getVerificationStatusMessage(status: string): string {
  return VERIFICATION_STATUS_MESSAGES[status as VerificationStatus] || '未知状态';
}

/**
 * 判断核验状态是否需要重新核验
 */
export function needsVerification(status: string): boolean {
  return status === VERIFICATION_STATUS.UNVERIFIED || status === VERIFICATION_STATUS.VERIFICATION_FAILED;
}

/**
 * 根据收钱吧API响应和当前订单状态判断核验结果
 */
export function determineVerificationResult(
  currentOrderStatus: string,
  sqbApiOrderStatus: string
): VerificationStatus {
  // 状态映射：将我们的内部状态映射到收钱吧状态
  const statusMapping: Record<string, string> = {
    'CREATED': SQB_ORDER_STATUS.CREATED,
    'SUCCESS': SQB_ORDER_STATUS.PAID,
    'FAILED': SQB_ORDER_STATUS.PAY_CANCELED,
    'CANCELLED': SQB_ORDER_STATUS.CANCELED
  };

  const expectedSqbStatus = statusMapping[currentOrderStatus];

  // 如果状态一致，核验正确
  if (expectedSqbStatus === sqbApiOrderStatus) {
    return VERIFICATION_STATUS.VERIFIED_CORRECT;
  }

  // 如果状态不一致，核验错误
  return VERIFICATION_STATUS.VERIFIED_ERROR;
}
