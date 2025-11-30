import { useState, useEffect } from 'react';
import { View, Text, Picker } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Button, Input, TextArea } from '@nutui/nutui-react-taro';
import api from '../../services/request';
import './apply.scss';

interface RefundPreview {
  orderId: string;
  orderNo: string;
  totalAmount: number;
  refundAmount: number;
  refundPercent: number;
  canRefund: boolean;
  reason?: string;
  activity: {
    id: string;
    title: string;
    startTime: string;
  };
}

const REFUND_REASONS = [
  { label: '个人原因取消', value: 'USER_CANCEL' },
  { label: '行程冲突', value: 'SCHEDULE_CONFLICT' },
  { label: '健康原因', value: 'HEALTH_ISSUE' },
  { label: '天气原因', value: 'WEATHER' },
  { label: '其他原因', value: 'OTHER' },
];

export default function RefundApply() {
  const router = useRouter();
  const orderId = router.params.orderId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [selectedReason, setSelectedReason] = useState(0);
  const [reasonDetail, setReasonDetail] = useState('');

  useEffect(() => {
    if (orderId) {
      loadRefundPreview();
    }
  }, [orderId]);

  const loadRefundPreview = async () => {
    try {
      setLoading(true);
      const data = await api.previewRefund(orderId);
      setPreview(data);
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReasonChange = (e: any) => {
    setSelectedReason(parseInt(e.detail.value));
  };

  const handleSubmit = async () => {
    if (!preview?.canRefund) {
      Taro.showToast({
        title: '当前订单不可退款',
        icon: 'none',
      });
      return;
    }

    try {
      setSubmitting(true);
      await api.createRefund({
        orderId,
        reason: REFUND_REASONS[selectedReason].value,
        reasonDetail: reasonDetail.trim() || undefined,
      });

      Taro.showToast({
        title: '退款申请已提交',
        icon: 'success',
      });

      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '提交失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View className="refund-apply-page loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!preview) {
    return (
      <View className="refund-apply-page error">
        <Text>订单信息加载失败</Text>
      </View>
    );
  }

  return (
    <View className="refund-apply-page">
      {/* 订单信息 */}
      <View className="order-info">
        <Text className="section-title">订单信息</Text>
        <View className="info-row">
          <Text className="label">活动名称</Text>
          <Text className="value">{preview.activity.title}</Text>
        </View>
        <View className="info-row">
          <Text className="label">活动时间</Text>
          <Text className="value">{formatDate(preview.activity.startTime)}</Text>
        </View>
        <View className="info-row">
          <Text className="label">订单号</Text>
          <Text className="value">{preview.orderNo}</Text>
        </View>
        <View className="info-row">
          <Text className="label">订单金额</Text>
          <Text className="value price">¥{preview.totalAmount}</Text>
        </View>
      </View>

      {/* 退款信息 */}
      <View className="refund-info">
        <Text className="section-title">退款信息</Text>
        {preview.canRefund ? (
          <>
            <View className="refund-amount">
              <Text className="label">预计退款</Text>
              <Text className="amount">¥{preview.refundAmount}</Text>
              <Text className="percent">({preview.refundPercent}%)</Text>
            </View>
            {preview.refundPercent < 100 && (
              <View className="refund-notice">
                <Text>根据退款政策，距活动开始时间越近，退款比例越低</Text>
              </View>
            )}
          </>
        ) : (
          <View className="no-refund">
            <Text className="title">暂不支持退款</Text>
            <Text className="reason">{preview.reason || '活动即将开始，已过可退款时间'}</Text>
          </View>
        )}
      </View>

      {/* 退款原因 */}
      {preview.canRefund && (
        <View className="refund-form">
          <Text className="section-title">退款原因</Text>

          <View className="form-item">
            <Text className="label">选择原因</Text>
            <Picker
              mode="selector"
              range={REFUND_REASONS.map(r => r.label)}
              value={selectedReason}
              onChange={handleReasonChange}
            >
              <View className="picker-value">
                <Text>{REFUND_REASONS[selectedReason].label}</Text>
                <Text className="arrow">▶</Text>
              </View>
            </Picker>
          </View>

          <View className="form-item">
            <Text className="label">补充说明（选填）</Text>
            <TextArea
              className="reason-input"
              placeholder="请输入详细说明..."
              value={reasonDetail}
              onChange={(val) => setReasonDetail(val)}
              maxLength={200}
            />
            <Text className="char-count">{reasonDetail.length}/200</Text>
          </View>
        </View>
      )}

      {/* 提交按钮 */}
      <View className="submit-bar">
        {preview.canRefund ? (
          <Button
            type="primary"
            size="large"
            block
            loading={submitting}
            disabled={submitting}
            onClick={handleSubmit}
          >
            提交退款申请
          </Button>
        ) : (
          <Button
            type="default"
            size="large"
            block
            onClick={() => Taro.navigateBack()}
          >
            返回
          </Button>
        )}
      </View>

      {/* 退款说明 */}
      <View className="refund-tips">
        <Text className="tips-title">退款说明</Text>
        <View className="tips-content">
          <Text>1. 退款申请提交后，需等待俱乐部审核</Text>
          <Text>2. 审核通过后，退款将原路返回</Text>
          <Text>3. 退款到账时间一般为1-7个工作日</Text>
          <Text>4. 如有疑问请联系俱乐部客服</Text>
        </View>
      </View>
    </View>
  );
}
