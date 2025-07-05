/**
 * 支付相关类型定义
 */

// 支付方式枚举
export enum PaymentMethod {
  ALIPAY = '2',  // 支付宝
  WECHAT = '3'   // 微信
}

// 支付成功数据类型
export interface PaymentSuccessData {
  chargedAmount: number;      // 充值金额（元）
  chargedCredits: number;     // 充值积分数
  previousCredits: number;    // 充值前积分数
  currentCredits: number;     // 充值后积分数
}

// 支付结果类型
export interface PaymentResult {
  success: boolean;
  message?: string;
  data?: PaymentSuccessData;
}

// 支付查询响应类型
export interface PaymentQueryResponse {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  result_code?: string;
  error_code?: string;
  error_message?: string;
  biz_response?: any;
  payment_success_info?: PaymentSuccessData;
}

// 默认轮询配置
export const DEFAULT_POLLING_CONFIG = {
  interval: 2000,    // 轮询间隔（毫秒）
  maxAttempts: 120,  // 最大轮询次数（4分钟）
  timeout: 240000    // 总超时时间（毫秒）
};
