import * as crypto from 'crypto';

// 收钱吧配置
export const SQB_CONFIG = {
  // 使用生产环境API地址
  API_BASE_URL: process.env.SQB_API_BASE_URL || 'https://vsi-api.shouqianba.com',
  VENDOR_SN: process.env.SQB_VENDOR_SN || '91802620',
  VENDOR_KEY: process.env.SQB_VENDOR_KEY || '4293e278592a11ae470199e23e4c1d96',
  APP_ID: process.env.SQB_APP_ID || '2025061300009239',
  TEST_ACTIVATION_CODE: process.env.SQB_TEST_ACTIVATION_CODE || '84038959',
  // 收钱吧公钥，用于回调验签
  PUBLIC_KEY: process.env.SQB_PUBLIC_KEY || '',
};

// MD5签名函数
export function generateMD5Sign(content: string, key: string): string {
  const signString = content + key;
  return crypto.createHash('md5').update(signString, 'utf8').digest('hex').toUpperCase();
}

/**
 * 验证收钱吧回调签名
 * 使用RSA SHA256WithRSA算法验证签名
 *
 * 根据收钱吧官方文档验签流程：
 * 1. 获取回调请求请求头header里面Authorization中的sign
 * 2. 解析回调通知请求报文获取到请求体body
 * 3. 获取收钱吧公钥
 * 4. 采用RSA的SHA256WithRSA签名算法，对获取的回调信息进行验签
 * 5. 返回验签结果
 *
 * @param requestBody 回调请求体（JSON字符串）
 * @param signature 从Authorization header中提取的签名
 * @param publicKey 收钱吧提供的公钥
 * @returns 验签结果
 */
export function verifySQBCallbackSignature(
  requestBody: string,
  signature: string,
  publicKey?: string
): { success: boolean; error?: string } {
  try {
    // 检查必要参数
    if (!requestBody || !signature) {
      return {
        success: false,
        error: '缺少必要的验签参数'
      };
    }

    // 检查公钥配置
    const sqbPublicKey = publicKey || SQB_CONFIG.PUBLIC_KEY;
    if (!sqbPublicKey) {
      return {
        success: false,
        error: '收钱吧公钥未配置，请联系技术对接人获取'
      };
    }

    // 格式化公钥（确保包含PEM格式的头尾）
    let formattedPublicKey = sqbPublicKey.trim();
    if (!formattedPublicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
      formattedPublicKey = `-----BEGIN PUBLIC KEY-----\n${formattedPublicKey}\n-----END PUBLIC KEY-----`;
    }

    // 创建验证器，使用RSA-SHA256算法
    const verifier = crypto.createVerify('RSA-SHA256');

    // 对请求体进行验签（根据收钱吧文档：对获取的回调信息进行验签）
    verifier.update(requestBody, 'utf8');

    // 验证签名（收钱吧的签名通常是base64编码）
    const isValid = verifier.verify(formattedPublicKey, signature, 'base64');

    if (isValid) {
      console.log('收钱吧回调签名验证成功');
      return { success: true };
    } else {
      console.log('收钱吧回调签名验证失败', {
        signatureLength: signature.length,
        bodyLength: requestBody.length,
        publicKeyLength: formattedPublicKey.length
      });
      return {
        success: false,
        error: '签名验证失败'
      };
    }

  } catch (error) {
    console.error('收钱吧签名验证异常:', error);
    return {
      success: false,
      error: `签名验证异常: ${error instanceof Error ? error.message : '未知错误'}`
    };
  }
}

// 生成设备ID
export function generateDeviceId(): string {
  return `WMZS_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// API响应接口定义
interface SQBApiResponse {
  success: boolean;
  data?: any;
  status?: number;
  error?: string;
  details?: any;
}

// 网络诊断函数
export async function diagnoseSQBConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('开始网络诊断...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${SQB_CONFIG.API_BASE_URL}/upay/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'test test',
      },
      body: JSON.stringify({ test: true }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`网络诊断 - 响应状态: ${response.status}`);

    return {
      success: true,
      message: `网络连接正常，响应状态: ${response.status}`,
      details: { status: response.status }
    };
  } catch (error) {
    console.error('网络诊断失败:', error);

    let message = '网络连接失败';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        message = '网络连接超时（5秒）';
      } else if (error.message.includes('fetch failed')) {
        message = '无法连接到收钱吧服务器';
      } else {
        message = error.message;
      }
    }

    return {
      success: false,
      message,
      details: error
    };
  }
}

// 收钱吧激活接口
export async function activateTerminal(deviceId: string, activationCode: string): Promise<SQBApiResponse> {
  const requestBody = {
    app_id: SQB_CONFIG.APP_ID,
    device_id: deviceId,
    code: activationCode,
  };

  const bodyString = JSON.stringify(requestBody);
  const sign = generateMD5Sign(bodyString, SQB_CONFIG.VENDOR_KEY);
  const authorization = `${SQB_CONFIG.VENDOR_SN} ${sign}`;

  try {
    const response = await fetch(`${SQB_CONFIG.API_BASE_URL}/terminal/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: bodyString,
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    return {
      success: response.ok,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
      details: error,
    };
  }
}

// 收钱吧签到接口
export async function checkinTerminal(
  terminalSn: string,
  terminalKey: string,
  deviceId: string
): Promise<SQBApiResponse> {
  const requestBody = {
    terminal_sn: terminalSn,
    device_id: deviceId,
  };

  const bodyString = JSON.stringify(requestBody);
  const sign = generateMD5Sign(bodyString, terminalKey);
  const authorization = `${terminalSn} ${sign}`;

  try {
    const response = await fetch(`${SQB_CONFIG.API_BASE_URL}/terminal/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: bodyString,
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    return {
      success: response.ok,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
      details: error,
    };
  }
}

// 收钱吧预下单接口
export async function createPayment(
  terminalSn: string,
  terminalKey: string,
  params: {
    client_sn: string;
    total_amount: number;
    subject: string;
    payway: string; // 2:支付宝, 3:微信
    operator?: string;
    notify_url?: string;
    description?: string;
  }
): Promise<SQBApiResponse> {
  // 构建请求体，严格按照官方文档要求
  const requestBody = {
    terminal_sn: terminalSn,
    client_sn: params.client_sn,
    total_amount: params.total_amount.toString(), // 必须是字符串
    subject: params.subject,
    payway: params.payway, // 必须是字符串
    operator: params.operator || 'system',
    notify_url: params.notify_url || process.env.SQB_NOTIFY_URL,
    description: params.description || params.subject,
  };

  const bodyString = JSON.stringify(requestBody);
  const sign = generateMD5Sign(bodyString, terminalKey);
  const authorization = `${terminalSn} ${sign}`;

  console.log('创建支付请求详情:', {
    url: `${SQB_CONFIG.API_BASE_URL}/upay/v2/precreate`,
    terminalSn,
    terminalKey: terminalKey ? '***' + terminalKey.slice(-4) : 'undefined',
    bodyString,
    sign: sign ? '***' + sign.slice(-4) : 'undefined',
    authorization: authorization ? authorization.split(' ')[0] + ' ***' + authorization.split(' ')[1]?.slice(-4) : 'undefined'
  });

  try {
    const response = await fetch(`${SQB_CONFIG.API_BASE_URL}/upay/v2/precreate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: bodyString,
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    return {
      success: response.ok,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
      details: error,
    };
  }
}

// 收钱吧支付查询接口
export async function queryPayment(
  terminalSn: string,
  terminalKey: string,
  clientSn: string
): Promise<SQBApiResponse> {
  const requestBody = {
    terminal_sn: terminalSn,
    client_sn: clientSn,
  };

  const bodyString = JSON.stringify(requestBody);
  const sign = generateMD5Sign(bodyString, terminalKey);
  const authorization = `${terminalSn} ${sign}`;

  try {
    const response = await fetch(`${SQB_CONFIG.API_BASE_URL}/upay/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: bodyString,
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    return {
      success: response.ok,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
      details: error,
    };
  }
}

// 收钱吧退款接口
export async function refundPayment(
  terminalSn: string,
  terminalKey: string,
  params: {
    client_sn?: string;           // 商户订单号
    sn?: string;                  // 收钱吧订单号
    refund_request_no: string;    // 退款序列号
    refund_amount: number;        // 退款金额（分）
    operator: string;             // 操作员
    refund_reason?: string;       // 退款原因
  }
): Promise<SQBApiResponse> {
  // 验证必要参数
  if (!params.client_sn && !params.sn) {
    return {
      success: false,
      error: 'client_sn和sn不能同时为空'
    };
  }

  // 构建请求体
  const requestBody: any = {
    terminal_sn: terminalSn,
    refund_request_no: params.refund_request_no,
    refund_amount: params.refund_amount.toString(),
    operator: params.operator
  };

  // 添加订单标识（优先使用sn）
  if (params.sn) {
    requestBody.sn = params.sn;
  } else if (params.client_sn) {
    requestBody.client_sn = params.client_sn;
  }

  // 添加退款原因（可选）
  if (params.refund_reason) {
    requestBody.reflect = JSON.stringify({ reason: params.refund_reason });
  }

  const bodyString = JSON.stringify(requestBody);
  const sign = generateMD5Sign(bodyString, terminalKey);
  const authorization = `${terminalSn} ${sign}`;

  console.log('退款请求详情:', {
    url: `${SQB_CONFIG.API_BASE_URL}/upay/v2/refund`,
    terminalSn,
    terminalKey: terminalKey ? '***' + terminalKey.slice(-4) : 'undefined',
    bodyString,
    sign: sign ? '***' + sign.slice(-4) : 'undefined',
    authorization: authorization ? authorization.split(' ')[0] + ' ***' + authorization.split(' ')[1]?.slice(-4) : 'undefined'
  });

  try {
    const response = await fetch(`${SQB_CONFIG.API_BASE_URL}/upay/v2/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: bodyString,
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    return {
      success: response.ok,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
      details: error,
    };
  }
}
