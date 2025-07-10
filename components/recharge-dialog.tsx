"use client";

import { useState, useRef, useEffect } from "react";
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  SQB_ORDER_STATUS,
  isFinalOrderStatus,
  isSuccessOrderStatus,
  isFailedOrderStatus,
  getOrderStatusMessage
} from '@/lib/sqb-constants';
import {
  PaymentMethod,
  type PaymentSuccessData,
} from '@/types/payment';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle,
  RefreshCw,
} from "lucide-react";

interface RechargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  requiredCredits?: number;
  currentCredits?: number;
}

export default function RechargeDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  requiredCredits, 
  currentCredits 
}: RechargeDialogProps) {
  const [step, setStep] = useState<'form' | 'qrcode' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.WECHAT);
  const [orderData, setOrderData] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [statusChecking, setStatusChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(240);
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const presetAmounts = [1, 5, 10, 20, 50, 100];

  // 用于存储定时器引用，确保组件卸载时能够清理
  const timersRef = useRef<{
    statusCheckTimer?: NodeJS.Timeout;
    countdownTimer?: NodeJS.Timeout;
    countdownCleanupTimer?: NodeJS.Timeout;
    successDelayTimer?: NodeJS.Timeout;
    closeDelayTimer?: NodeJS.Timeout;
  }>({});

  // 存储状态检查清理函数
  const statusCheckCleanupRef = useRef<(() => void) | null>(null);

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      // 清理状态检查
      if (statusCheckCleanupRef.current) {
        statusCheckCleanupRef.current();
        statusCheckCleanupRef.current = null;
      }
      // 清理所有定时器
      Object.values(timersRef.current).forEach(timer => {
        if (timer) {
          clearTimeout(timer);
          clearInterval(timer);
        }
      });
      timersRef.current = {};
    };
  }, []);

  // 弹窗关闭时清理定时器
  useEffect(() => {
    if (!open) {
      // 清理状态检查
      if (statusCheckCleanupRef.current) {
        statusCheckCleanupRef.current();
        statusCheckCleanupRef.current = null;
      }
      // 弹窗关闭时清理所有定时器
      Object.values(timersRef.current).forEach(timer => {
        if (timer) {
          clearTimeout(timer);
          clearInterval(timer);
        }
      });
      timersRef.current = {};
      setStatusChecking(false);
    }
  }, [open]);

  // 重置状态
  const resetDialog = () => {
    setStep('form');
    setLoading(false);
    setAmount(1);
    setCustomAmount('');
    setPaymentMethod(PaymentMethod.WECHAT);
    setOrderData(null);
    setQrCodeUrl('');
    setStatusChecking(false);
    setTimeLeft(240);
    setSuccessData(null);
    setIsProcessingPayment(false);
  };

  // 处理弹窗关闭
  const handleClose = () => {
    onOpenChange(false);
    // 使用定时器引用，确保可以被清理
    timersRef.current.closeDelayTimer = setTimeout(resetDialog, 300);
  };

  // 创建支付订单
  const createPayment = async () => {
    setLoading(true);
    try {
      const finalAmount = customAmount ? parseFloat(customAmount) : amount;

      if (finalAmount <= 0 || finalAmount > 10000) {
        throw new Error('充值金额必须在0.01-10000元之间');
      }

      // 直接创建支付订单（后端会自动处理终端激活）
      const response = await fetch('/api/sqb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_payment',
          amount: finalAmount,
          subject: '积分充值',
          payway: paymentMethod,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '创建支付订单失败');
      }

      setOrderData(result.data);

      // 生成二维码
      const qrDataUrl = await QRCode.toDataURL(result.data.qr_code, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);

      setStep('qrcode');
      statusCheckCleanupRef.current = startStatusCheck(result.data.client_sn);
      startCountdown();
    } catch (error) {
      console.error('创建支付订单失败:', error);
      alert(error instanceof Error ? error.message : '创建支付订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 开始状态检查 - 优化版本，使用指数退避策略
  const startStatusCheck = (clientSn: string) => {
    setStatusChecking(true);
    let checkCount = 0;

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/sqb?action=query_payment&client_sn=${clientSn}`);
        const result = await response.json();

        console.log(`支付状态查询结果 (第${checkCount + 1}次):`, result);

        if (result.success && result.data?.biz_response?.biz_response?.data?.order_status) {
          const orderStatus = result.data.biz_response.biz_response.data.order_status;
          const orderData = result.data.biz_response.biz_response.data;
          console.log(`当前订单状态 (第${checkCount + 1}次):`, orderStatus, '状态描述:', getOrderStatusMessage(orderStatus));
          console.log('订单详细信息:', {
            trade_no: orderData.trade_no,
            finish_time: orderData.finish_time,
            total_amount: orderData.total_amount,
            payment_list: orderData.payment_list
          });

          // 检查是否为最终状态（需要停止轮询）
          if (isFinalOrderStatus(orderStatus)) {
            console.log('订单已达到最终状态，停止轮询');
            setStatusChecking(false);

            // 根据状态类型处理
            if (isSuccessOrderStatus(orderStatus)) {
              console.log('支付成功，直接处理支付结果');
              // 直接使用查询结果处理支付成功，不再调用get_payment_result
              handlePaymentSuccessFromQueryResult(result.data);
            } else if (isFailedOrderStatus(orderStatus)) {
              console.log('支付失败或取消');
              toast.error(`支付失败：${getOrderStatusMessage(orderStatus)}`);
            } else {
              // 其他最终状态（如退款等）
              toast.info(`订单状态：${getOrderStatusMessage(orderStatus)}`);
            }
            return; // 停止轮询
          }
        } else if (!result.success) {
          console.error('查询支付状态失败:', result.message);
        }

        // 继续轮询 - 使用指数退避策略
        checkCount++;
        let nextDelay: number;

        if (checkCount <= 10) {
          // 前10次：每2秒查询一次（前20秒）
          nextDelay = 2000;
        } else if (checkCount <= 20) {
          // 11-20次：每5秒查询一次（接下来50秒）
          nextDelay = 5000;
        } else if (checkCount <= 30) {
          // 21-30次：每10秒查询一次（接下来100秒）
          nextDelay = 10000;
        } else {
          // 30次后：每15秒查询一次（剩余时间）
          nextDelay = 15000;
        }

        // 检查是否超时（8分钟，收钱吧状态同步可能较慢）
        if (checkCount >= 60) { // 大约8分钟（前10次2s + 10次5s + 10次10s + 30次15s = 20+50+100+450 = 620秒）
          console.log('支付轮询超时，已停止。如果您已经支付成功，请稍等几分钟后刷新页面查看积分');
          setStatusChecking(false);
          toast.warning('支付轮询超时。如果您已经支付成功，请稍等几分钟后刷新页面查看积分', {
            duration: 8000
          });
          return;
        }

        // 设置下次查询
        timersRef.current.statusCheckTimer = setTimeout(checkPaymentStatus, nextDelay);

      } catch (error) {
        console.error('查询支付状态异常:', error);
        // 网络异常时继续尝试，使用较长的延迟
        checkCount++;
        if (checkCount < 40) { // 限制重试次数
          timersRef.current.statusCheckTimer = setTimeout(checkPaymentStatus, 5000);
        } else {
          setStatusChecking(false);
          toast.error('网络异常，请稍后重试');
        }
      }
    };

    // 立即开始第一次查询
    checkPaymentStatus();

    // 清理函数
    return () => {
      if (timersRef.current.statusCheckTimer) {
        clearTimeout(timersRef.current.statusCheckTimer);
        timersRef.current.statusCheckTimer = undefined;
      }
      setStatusChecking(false);
    };
  };

  // 开始倒计时
  const startCountdown = () => {
    timersRef.current.countdownTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timersRef.current.countdownTimer) {
            clearInterval(timersRef.current.countdownTimer);
            timersRef.current.countdownTimer = undefined;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 30分钟后清除
    timersRef.current.countdownCleanupTimer = setTimeout(() => {
      if (timersRef.current.countdownTimer) {
        clearInterval(timersRef.current.countdownTimer);
        timersRef.current.countdownTimer = undefined;
      }
    }, 1800000);
  };

  // 直接从查询结果处理支付成功 - 新的优化版本
  const handlePaymentSuccessFromQueryResult = async (queryResultData: any) => {
    // 防止重复处理
    if (isProcessingPayment) {
      console.log('支付结果正在处理中，跳过重复调用');
      return;
    }

    setIsProcessingPayment(true);

    try {
      console.log('处理支付成功结果:', queryResultData);

      // 检查是否包含支付成功信息
      if (queryResultData.payment_success_info) {
        const { charged_amount, charged_credits, current_credits, previous_credits } = queryResultData.payment_success_info;

        // 设置成功数据
        setSuccessData({
          chargedAmount: charged_amount,
          chargedCredits: charged_credits,
          previousCredits: previous_credits,
          currentCredits: current_credits
        });

        // 显示成功页面
        setStep('success');

        // 显示toast提示
        toast.success('充值成功！积分已到账', {
          description: `获得 ${charged_credits} 积分，当前余额 ${current_credits} 积分`
        });

        // 刷新积分数据
        onSuccess();

        console.log('支付成功处理完成');
      } else {
        // 如果没有积分信息，说明后端处理可能还在进行中，稍等一下再刷新
        console.log('支付成功但积分信息尚未准备好，1秒后刷新积分');
        timersRef.current.successDelayTimer = setTimeout(async () => {
          onSuccess();
          toast.success('支付成功！积分已到账');
        }, 1000);
      }

    } catch (error) {
      console.error('处理支付成功结果异常:', error);
      toast.error('支付成功，但显示结果时出现异常，请刷新页面查看积分');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 支付成功处理 - 优化版本，从后端获取准确的支付结果，带幂等性检查
  const handlePaymentSuccess = async () => {
    // 防止重复处理
    if (isProcessingPayment) {
      console.log('支付结果正在处理中，跳过重复调用');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // 调用后端API获取支付成功后的完整信息
      const paymentResultResponse = await fetch('/api/sqb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_payment_result',
          client_sn: orderData?.client_sn
        })
      });

      if (paymentResultResponse.ok) {
        const paymentResult = await paymentResultResponse.json();

        if (paymentResult.success && paymentResult.data) {
          const {
            charged_amount,
            charged_credits,
            previous_credits,
            current_credits
          } = paymentResult.data;

          // 设置成功数据（使用后端返回的准确数据）
          setSuccessData({
            chargedAmount: charged_amount,
            chargedCredits: charged_credits,
            previousCredits: previous_credits,
            currentCredits: current_credits
          });

          // 显示成功页面
          setStep('success');

          // 显示toast提示
          toast.success('充值成功！积分已到账', {
            description: `获得 ${charged_credits} 积分，当前余额 ${current_credits} 积分`
          });

          // 刷新积分数据
          onSuccess();
          return;
        }
      }

      // 如果获取详细信息失败，使用基本的成功处理
      toast.success('充值成功！积分已到账');
      onSuccess();
      handleClose();

    } catch (error) {
      console.error('获取支付结果失败:', error);
      // 如果获取支付结果失败，仍然显示基本的成功提示
      toast.success('充值成功！积分已到账');
      onSuccess();
      handleClose();
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 格式化倒计时
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'form' ? '积分充值' : step === 'qrcode' ? '扫码支付' : '充值成功'}
          </DialogTitle>
          {step === 'qrcode' && (
            <DialogDescription>
              请使用{paymentMethod === PaymentMethod.WECHAT ? '微信' : '支付宝'}扫描下方二维码完成支付
            </DialogDescription>
          )}
          {step === 'success' && (
            <DialogDescription>
              恭喜您！积分充值已完成
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-6">
            {/* 积分不足提示 */}
            {requiredCredits && currentCredits !== undefined && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <div className="text-sm text-orange-800 dark:text-orange-200">
                  <div className="font-medium mb-1">积分不足</div>
                  <div>访问此资源需要 <span className="font-bold">{requiredCredits}</span> 积分</div>
                  <div>当前余额：<span className="font-bold">{currentCredits}</span> 积分</div>
                  <div>还需要：<span className="font-bold text-red-600">{requiredCredits - currentCredits}</span> 积分</div>
                </div>
              </div>
            )}

            {/* 预设金额 */}
            <div>
              <Label className="text-sm font-medium">选择充值金额</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {presetAmounts.map((preset) => (
                  <Button
                    key={preset}
                    variant={amount === preset && !customAmount ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setAmount(preset);
                      setCustomAmount('');
                    }}
                  >
                    ¥{preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* 自定义金额 */}
            <div>
              <Label htmlFor="custom-amount" className="text-sm font-medium">
                或输入自定义金额
              </Label>
              <Input
                id="custom-amount"
                type="number"
                placeholder="0.01 - 10000"
                min="0.01"
                max="10000"
                step="0.01"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  if (e.target.value) {
                    setAmount(0);
                  }
                }}
                className="mt-1"
              />
            </div>

            {/* 积分说明 */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span>充值金额:</span>
                <span>¥{customAmount ? parseFloat(customAmount) || 0 : amount}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>获得积分:</span>
                <span className="text-primary font-medium">
                  {Math.floor((customAmount ? parseFloat(customAmount) || 0 : amount) * 100)}积分
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                1元 = 100积分
              </div>
            </div>

            {/* 支付方式 */}
            <div>
              <Label className="text-sm font-medium">支付方式</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={paymentMethod === PaymentMethod.WECHAT ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(PaymentMethod.WECHAT)}
                  className="flex items-center gap-2"
                >
                  <span className="text-green-600">💬</span>
                  微信支付
                </Button>
                <Button
                  variant={paymentMethod === PaymentMethod.ALIPAY ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(PaymentMethod.ALIPAY)}
                  className="flex items-center gap-2"
                >
                  <span className="text-blue-600">🅰️</span>
                  支付宝
                </Button>
              </div>
            </div>
          </div>
        ) : step === 'qrcode' ? (
          <div className="space-y-4 text-center">
            {/* 二维码 */}
            <div className="flex justify-center">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="支付二维码" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>

            {/* 订单信息 */}
            {orderData && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>订单号:</span>
                  <span className="font-mono text-xs">{orderData.client_sn}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>支付金额:</span>
                  <span>¥{(orderData.amount / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>获得积分:</span>
                  <span className="text-primary font-medium">{orderData.credits}积分</span>
                </div>
              </div>
            )}

            {/* 倒计时 */}
            <div className="text-sm text-muted-foreground">
              {timeLeft > 0 ? (
                <>订单将在 <span className="font-mono text-primary">{formatTime(timeLeft)}</span> 后过期</>
              ) : (
                <span className="text-destructive">订单已过期</span>
              )}
            </div>

            {/* 状态提示 */}
            {statusChecking && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  正在等待支付...
                </div>
                <div className="text-xs text-muted-foreground">
                  如果您已经支付成功但状态未更新，请点击下方按钮手动刷新
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('手动刷新支付状态');
                    // 重新开始状态检查
                    if (orderData?.client_sn) {
                      statusCheckCleanupRef.current = startStatusCheck(orderData.client_sn);
                    }
                  }}
                  disabled={!orderData?.client_sn}
                >
                  手动刷新状态
                </Button>
              </div>
            )}
          </div>
        ) : step === 'success' ? (
          /* 充值成功页面 */
          <div className="space-y-6 text-center">
            {/* 成功图标 */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            {/* 成功信息 */}
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">充值成功！</h3>
              <p className="text-muted-foreground">您的积分已成功充值到账</p>
            </div>

            {/* 充值详情 */}
            {successData && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">充值金额</span>
                  <span className="font-medium">¥{successData.chargedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">获得积分</span>
                  <span className="font-medium text-green-600">+{successData.chargedCredits}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">原有积分</span>
                    <span className="text-sm">{successData.previousCredits}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="font-medium">当前积分</span>
                    <span className="font-bold text-primary text-lg">{successData.currentCredits}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 温馨提示 */}
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <p>💡 积分可用于访问付费资源，感谢您的支持！</p>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button
                onClick={createPayment}
                disabled={loading || (!customAmount && amount <= 0) || (!!customAmount && (parseFloat(customAmount) <= 0 || parseFloat(customAmount) > 10000))}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    创建订单...
                  </>
                ) : (
                  '立即支付'
                )}
              </Button>
            </>
          ) : step === 'qrcode' ? (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                返回
              </Button>
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
            </>
          ) : step === 'success' ? (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                继续充值
              </Button>
              <Button onClick={handleClose}>
                完成
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
