/**
 * 统一日志记录工具
 * 支持结构化日志和不同级别的日志记录
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string;
  userEmail?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  action?: string;
  resource?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  constructor() {
    // 根据环境设置日志级别，支持客户端和服务端
    const isProduction = typeof window !== 'undefined'
      ? process.env.NODE_ENV === 'production'
      : process.env.NODE_ENV === 'production';
    this.logLevel = isProduction ? LogLevel.INFO : LogLevel.DEBUG;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };
  }

  private output(logEntry: LogEntry): void {
    const { timestamp, level, message, context, error } = logEntry;
    const levelName = LogLevel[level];
    const isProduction = typeof window !== 'undefined'
      ? process.env.NODE_ENV === 'production'
      : process.env.NODE_ENV === 'production';

    // 在生产环境使用结构化日志
    if (isProduction) {
      const logData = {
        timestamp,
        level: levelName,
        message,
        context,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
        client: typeof window !== 'undefined' // 标识是否为客户端日志
      };
      console.log(JSON.stringify(logData));
    } else {
      // 开发环境使用可读格式
      const clientPrefix = typeof window !== 'undefined' ? '[CLIENT] ' : '[SERVER] ';
      const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
      const errorStr = error ? ` | Error: ${error.message}` : '';

      // 根据日志级别使用不同的console方法
      const logMessage = `${clientPrefix}[${timestamp}] ${levelName}: ${message}${contextStr}${errorStr}`;

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(logMessage);
          break;
        case LogLevel.INFO:
          console.info(logMessage);
          break;
        case LogLevel.WARN:
          console.warn(logMessage);
          break;
        case LogLevel.ERROR:
          console.error(logMessage);
          break;
        default:
          console.log(logMessage);
      }

      if (error && error.stack) {
        console.error(error.stack);
      }
    }
  }

  public debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatLog(LogLevel.DEBUG, message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatLog(LogLevel.INFO, message, context));
    }
  }

  public warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatLog(LogLevel.WARN, message, context));
    }
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatLog(LogLevel.ERROR, message, context, error));
    }
  }

  // 安全事件日志
  public security(message: string, context?: LogContext): void {
    this.output(this.formatLog(LogLevel.ERROR, `[SECURITY] ${message}`, {
      ...context,
      security: true,
    }));
  }

  // 审计日志
  public audit(action: string, context?: LogContext): void {
    this.output(this.formatLog(LogLevel.INFO, `[AUDIT] ${action}`, {
      ...context,
      audit: true,
    }));
  }
}

// 导出单例实例
export const logger = Logger.getInstance();

// 便捷函数
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context),
  security: (message: string, context?: LogContext) => logger.security(message, context),
  audit: (action: string, context?: LogContext) => logger.audit(action, context),
};
