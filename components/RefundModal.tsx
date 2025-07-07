'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (refundAmount: number, refundReason: string) => void;
  order: {
    client_sn: string;
    subject: string;
    total_amount: number;
    refund_amount?: number;
    amount_yuan: string;
  } | null;
  loading?: boolean;
}

export default function RefundModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  order, 
  loading = false 
}: RefundModalProps) {
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [isFullRefund, setIsFullRefund] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  // 计算可退款金额
  const totalAmount = order.total_amount;
  const refundedAmount = order.refund_amount || 0;
  const availableAmount = totalAmount - refundedAmount;
  const availableAmountYuan = availableAmount / 100;

  // 处理全额退款切换
  const handleFullRefundToggle = (checked: boolean) => {
    setIsFullRefund(checked);
    if (checked) {
      setRefundAmount(availableAmountYuan.toFixed(2));
    } else {
      setRefundAmount('');
    }
  };

  // 处理退款金额输入
  const handleAmountChange = (value: string) => {
    setRefundAmount(value);
    setIsFullRefund(parseFloat(value) === availableAmountYuan);
  };

  // 验证退款金额
  const validateAmount = (): string | null => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      return '退款金额必须大于0';
    }
    if (amount > availableAmountYuan) {
      return `退款金额不能超过可退款金额 ¥${availableAmountYuan.toFixed(2)}`;
    }
    return null;
  };

  // 处理确认退款
  const handleConfirm = () => {
    const error = validateAmount();
    if (error) {
      toast.error(error);
      return;
    }

    if (!refundReason.trim()) {
      toast.error('请填写退款原因');
      return;
    }

    onConfirm(parseFloat(refundAmount), refundReason.trim());
  };

  // 重置表单
  const handleClose = () => {
    setRefundAmount('');
    setRefundReason('');
    setIsFullRefund(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">订单退款</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 订单信息 */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">订单号：</span>
              <span className="text-sm font-mono">{order.client_sn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">订单标题：</span>
              <span className="text-sm">{order.subject}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">订单金额：</span>
              <span className="text-sm font-semibold">¥{order.amount_yuan}</span>
            </div>
            {refundedAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">已退款：</span>
                <span className="text-sm text-orange-600">¥{(refundedAmount / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">可退款金额：</span>
              <span className="text-sm font-semibold text-green-600">¥{availableAmountYuan.toFixed(2)}</span>
            </div>
          </div>

          {/* 退款金额 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              退款金额（元）
            </label>
            <div className="space-y-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={availableAmountYuan}
                value={refundAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入退款金额"
                disabled={loading}
              />
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isFullRefund}
                  onChange={(e) => handleFullRefundToggle(e.target.checked)}
                  className="mr-2"
                  disabled={loading}
                />
                <span className="text-sm text-gray-600">全额退款</span>
              </label>
            </div>
          </div>

          {/* 退款原因 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              退款原因
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请填写退款原因..."
              disabled={loading}
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end space-x-3 p-6 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? '处理中...' : '确认退款'}
          </button>
        </div>
      </div>
    </div>
  );
}
