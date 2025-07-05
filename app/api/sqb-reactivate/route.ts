import { NextRequest } from 'next/server';
import {
  activateTerminal,
  generateDeviceId,
} from '@/lib/sqb-utils';
import {
  storeMainTerminalInfo,
  type TerminalInfo,
} from '@/lib/redis-cache';
import { log } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    log.info('开始重新激活收钱吧终端', { timestamp: new Date().toISOString() });

    // 使用新的激活码
    const newActivationCode = '84038959';
    const deviceId = generateDeviceId();
    
    log.info('开始重新激活终端', { deviceId, activationCode: newActivationCode });
    
    const activateResult = await activateTerminal(deviceId, newActivationCode);
    
    if (!activateResult.success) {
      log.error('激活失败', undefined, {
        error: activateResult.error || '未知错误',
        message: activateResult.data?.message || '激活失败'
      });
      return Response.json({
        success: false,
        message: activateResult.data?.message || '激活失败',
        error: activateResult.error
      });
    }

    // 解析激活结果
    const bizResponse = activateResult.data?.biz_response;
    if (!bizResponse?.terminal_sn || !bizResponse?.terminal_key) {
      log.error('激活响应格式错误，缺少终端信息', undefined, {
        data: activateResult.data,
        bizResponse
      });
      return Response.json({
        success: false,
        message: '激活响应格式错误，缺少终端信息',
        data: activateResult.data
      });
    }

    // 存储新的终端信息
    const newTerminalInfo: TerminalInfo = {
      terminal_sn: bizResponse.terminal_sn,
      terminal_key: bizResponse.terminal_key,
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
        terminal_sn: bizResponse.terminal_sn,
        device_id: deviceId,
        activation_code: newActivationCode,
        activated_at: newTerminalInfo.activated_at
      }
    });

  } catch (error) {
    log.error('重新激活终端失败', error as Error);
    return Response.json({
      success: false,
      message: '服务器内部错误',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
