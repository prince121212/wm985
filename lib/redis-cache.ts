import { createClient } from 'redis';
import { log } from './logger';

// Redis 连接池配置
interface RedisPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
}

// 简化的Redis连接管理
class RedisConnectionManager {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<ReturnType<typeof createClient>> | null = null;

  async getClient(): Promise<ReturnType<typeof createClient>> {
    // 如果已有可用连接，直接返回
    if (this.client && this.client.isReady) {
      return this.client;
    }

    // 如果正在连接，等待连接完成
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // 开始新的连接
    this.isConnecting = true;
    this.connectionPromise = this.createConnection();

    try {
      this.client = await this.connectionPromise;
      return this.client;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async createConnection(): Promise<ReturnType<typeof createClient>> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL 环境变量未配置');
    }

    // 清理旧连接
    if (this.client) {
      try {
        await this.client.quit();
      } catch (e) {
        log.warn('清理旧Redis连接时出错', e as Error);
      }
      this.client = null;
    }

    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,    // 连接超时10秒
        keepAlive: true,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            log.error(`Redis 重连失败，已达到最大重试次数: ${retries}`);
            return false;
          }
          const delay = Math.min(retries * 2000, 8000); // 2秒、4秒、6秒
          log.info(`Redis 重连策略: 第${retries}次重试，${delay}ms后重连`);
          return delay;
        },
      },
      disableOfflineQueue: false,
      commandsQueueMaxLength: 100,
    });

    // 简化的事件处理
    client.on('error', (err) => {
      log.error('Redis 连接错误', err);
      // 严重错误时重置连接
      if (err.message.includes('ECONNREFUSED') ||
          err.message.includes('ETIMEDOUT') ||
          err.message.includes('ENOTFOUND')) {
        this.client = null;
      }
    });

    client.on('connect', () => {
      log.info('Redis 连接成功');
    });

    client.on('ready', () => {
      log.info('Redis 连接就绪');
    });

    client.on('end', () => {
      log.warn('Redis 连接已结束');
      this.client = null;
    });

    // 连接到Redis
    await client.connect();
    return client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (e) {
        log.warn('断开Redis连接时出错', e as Error);
      }
      this.client = null;
    }
  }
}

// 全局连接管理器实例
const redisManager = new RedisConnectionManager();

// 获取Redis客户端的简化接口
export async function getRedisClient() {
  return redisManager.getClient();
}

// 终端信息接口
export interface TerminalInfo {
  terminal_sn: string;
  terminal_key: string;
  device_id: string;
  last_checkin?: string;
  created_at?: string;
  activated_at?: string;
  activation_code?: string;
  last_updated?: string;
}

// 支付订单数据接口
export interface PaymentOrderData {
  client_sn: string;
  device_id: string;
  terminal_sn: string;
  amount: number;
  subject: string;
  payway: string;
  qr_code?: string;
  cached_at?: string;
  [key: string]: unknown; // 允许其他字段
}

// 缓存键名生成器
const CACHE_KEYS = {
  // 主终端信息（全局共享）
  mainTerminal: () => `sqb:main_terminal`,
  // 签到状态（按日期）
  checkin: (date: string) => `sqb:checkin:${date}`,
  // 支付订单（按订单号）
  payment: (clientSn: string) => `sqb:payment:${clientSn}`,
  // 用户会话（可选，用于跟踪用户状态）
  userSession: (userId: string) => `sqb:user:${userId}`,
} as const;

// 缓存过期时间（秒）
const CACHE_TTL = {
  terminal: 7 * 24 * 60 * 60, // 7天
  checkin: 24 * 60 * 60,      // 24小时
  payment: 30 * 60,           // 30分钟
} as const;

/**
 * 存储主终端信息到 Redis（全局共享）
 */
export async function storeMainTerminalInfo(terminalInfo: TerminalInfo): Promise<void> {
  try {
    await safeRedisOperation(async (client) => {
      const key = CACHE_KEYS.mainTerminal();

      const data = {
        ...terminalInfo,
        created_at: terminalInfo.created_at || new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      await client.setEx(key, CACHE_TTL.terminal, JSON.stringify(data));
    });

    log.info('主终端信息已存储到 Redis', {
      device_id: terminalInfo.device_id,
      terminal_sn: terminalInfo.terminal_sn
    });
  } catch (error) {
    log.error('存储主终端信息失败', error as Error);
    throw error;
  }
}

/**
 * 存储终端信息到 Redis（兼容旧版本）
 */
export async function storeTerminalInfo(terminalInfo: TerminalInfo): Promise<void> {
  return storeMainTerminalInfo(terminalInfo);
}

/**
 * 获取主终端信息
 */
export async function getMainTerminalInfo(): Promise<TerminalInfo | null> {
  try {
    return await safeRedisOperation(async (client) => {
      const key = CACHE_KEYS.mainTerminal();
      const data = await client.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as TerminalInfo;
    });
  } catch (error) {
    log.error('获取主终端信息失败', error as Error);
    return null;
  }
}

/**
 * 获取终端信息（兼容旧版本）
 */
export async function getTerminalInfo(deviceId: string): Promise<TerminalInfo | null> {
  // 忽略 deviceId 参数，直接返回主终端信息
  return getMainTerminalInfo();
}

/**
 * 标记今日已签到
 */
export async function markCheckinToday(deviceId: string): Promise<void> {
  try {
    await safeRedisOperation(async (client) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const key = CACHE_KEYS.checkin(today);

      await client.setEx(key, CACHE_TTL.checkin, JSON.stringify({
        device_id: deviceId,
        checkin_time: new Date().toISOString(),
      }));
    });

    log.info('签到状态已更新', { device_id: deviceId });
  } catch (error) {
    log.error('更新签到状态失败', error as Error);
    throw error;
  }
}

/**
 * 检查今日是否已签到
 */
export async function hasCheckedInToday(): Promise<boolean> {
  try {
    return await safeRedisOperation(async (client) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const key = CACHE_KEYS.checkin(today);
      const data = await client.get(key);

      return data !== null;
    });
  } catch (error) {
    log.error('检查签到状态失败', error as Error);
    return false; // 出错时假设未签到，允许重新签到
  }
}

/**
 * 缓存支付订单数据
 */
export async function cachePaymentOrder(orderData: PaymentOrderData): Promise<void> {
  try {
    await safeRedisOperation(async (client) => {
      const key = CACHE_KEYS.payment(orderData.client_sn);

      const data = {
        ...orderData,
        cached_at: new Date().toISOString(),
      };

      await client.setEx(key, CACHE_TTL.payment, JSON.stringify(data));
    });

    log.info('支付订单已缓存', { client_sn: orderData.client_sn });
  } catch (error) {
    log.error('缓存支付订单失败', error as Error);
    throw error;
  }
}

/**
 * 获取缓存的支付订单数据
 */
export async function getCachedPaymentOrder(clientSn: string): Promise<PaymentOrderData | null> {
  try {
    return await safeRedisOperation(async (client) => {
      const key = CACHE_KEYS.payment(clientSn);
      const data = await client.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as PaymentOrderData;
    });
  } catch (error) {
    log.error('获取缓存支付订单失败', error as Error);
    return null;
  }
}

/**
 * 删除终端信息
 */
export async function deleteTerminalInfo(deviceId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    const terminalKey = CACHE_KEYS.mainTerminal();

    // 删除主终端信息
    await client.del(terminalKey);

    // 删除相关的签到记录
    const checkinKeys = await client.keys(`sqb:checkin:*`);
    if (checkinKeys.length > 0) {
      await client.del(checkinKeys);
    }

    log.info('终端信息已删除', { device_id: deviceId });
  } catch (error) {
    log.error('删除终端信息失败', error as Error);
    throw error;
  }
}

/**
 * 安全执行 Redis 操作，带重试机制
 */
async function safeRedisOperation<T>(operation: (client: ReturnType<typeof createClient>) => Promise<T>): Promise<T> {
  let lastError: Error | unknown;

  // 最多重试2次
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const client = await getRedisClient();

      if (!client || !client.isReady) {
        throw new Error(`Redis 客户端未就绪 (尝试 ${attempt}/2)`);
      }

      return await operation(client);

    } catch (error) {
      lastError = error;
      log.warn(`Redis 操作失败 (尝试 ${attempt}/2)`, {
        error: error instanceof Error ? error.message : String(error),
        attempt
      });

      // 第一次失败后，短暂等待后重试
      if (attempt === 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // 所有重试都失败了
  log.error('Redis 操作最终失败', lastError as Error);
  throw lastError;
}



/**
 * 获取 Redis 连接状态
 */
export async function getRedisStatus(): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = await getRedisClient();

    if (!client || !client.isReady) {
      return {
        connected: false,
        error: 'Redis 客户端未就绪'
      };
    }

    // 测试连接
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 3000))
    ]);

    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message
    };
  }
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedisConnection(): Promise<void> {
  await redisManager.disconnect();
  log.info('Redis 连接已关闭');
}
