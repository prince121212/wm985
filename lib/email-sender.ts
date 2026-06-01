/**
 * Resend 邮件发送服务
 * Resend Email Sender
 *
 * 通过 Resend API 发送邮件，兼容边缘运行时（Vercel / Cloudflare），无需 SMTP。
 */

import { log } from '@/lib/logger';

const config = {
  fromEmail: process.env.RESEND_FROM_EMAIL || '',
  fromName: process.env.RESEND_FROM_NAME || 'pc-t',
};

/**
 * 邮件发送接口
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string;
}

/**
 * 通过 Resend 发送邮件
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // 验证必要参数
  if (!options.to || !options.subject) {
    log.error('邮件发送失败: 缺少必要参数', undefined, { to: options.to, subject: options.subject });
    return false;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.error('邮件发送失败: 未配置 RESEND_API_KEY', undefined, { to: options.to, subject: options.subject });
    return false;
  }

  const fromEmail = options.from || config.fromEmail;
  if (!fromEmail) {
    log.error('邮件发送失败: 未配置发件人地址 RESEND_FROM_EMAIL', undefined, { to: options.to, subject: options.subject });
    return false;
  }

  try {
    // 动态导入，避免在不需要时加载 SDK
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: `${options.fromName || config.fromName} <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html ?? options.text ?? '',
      text: options.text,
    });

    if (error) {
      log.error('Resend 邮件发送失败', error as unknown as Error, { to: options.to, subject: options.subject });
      return false;
    }

    log.info('Resend 邮件发送成功', { messageId: data?.id, to: options.to, subject: options.subject });
    return true;
  } catch (error) {
    log.error('Resend 邮件发送异常', error as Error, { to: options.to, subject: options.subject });
    return false;
  }
}

/**
 * 测试邮件服务连接（校验 API Key 是否有效）
 */
export async function testEmailService(): Promise<{
  resend: boolean;
  message: string;
}> {
  const result = {
    resend: false,
    message: '',
  };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    result.message = 'Resend 配置缺失: 未设置 RESEND_API_KEY; ';
    return result;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    // 通过列出已验证域名来探活，间接校验 API Key
    const { error } = await resend.domains.list();
    if (error) {
      result.message = `Resend 连接失败: ${error.message}; `;
      log.error('Resend 连接测试失败', error as unknown as Error);
      return result;
    }

    result.resend = true;
    result.message = 'Resend 连接正常; ';
  } catch (error) {
    result.message = `Resend 连接失败: ${error}; `;
    log.error('Resend 连接测试失败', error as Error);
  }

  return result;
}
