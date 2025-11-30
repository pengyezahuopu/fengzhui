import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import api from '../../services/request';
import './result.scss';

interface OrderInfo {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  activity: {
    id: string;
    title: string;
    startTime: string;
    coverUrl: string;
  };
}

export default function OrderResult() {
  const router = useRouter();
  const { orderId, status: initialStatus } = router.params;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [status, setStatus] = useState<'success' | 'pending' | 'failed'>(
    (initialStatus as any) || 'pending'
  );

  useEffect(() => {
    if (!orderId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    const loadOrder = async () => {
      try {
        const orderData = await api.getOrderDetail(orderId);
        setOrder(orderData);

        // 根据订单状态更新显示状态
        if (orderData.status === 'PAID' || orderData.status === 'COMPLETED') {
          setStatus('success');
        } else if (orderData.status === 'PENDING' || orderData.status === 'PAYING') {
          // 尝试同步支付状态
          const syncResult = await api.syncPaymentStatus(orderId);
          if (syncResult.needUpdate) {
            setStatus('success');
          } else {
            setStatus('pending');
          }
        } else {
          setStatus('failed');
        }
      } catch (error) {
        console.error('加载订单失败:', error);
        setStatus('failed');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  // 查看订单详情
  const handleViewOrder = () => {
    Taro.redirectTo({
      url: `/pages/order/detail?orderId=${orderId}`,
    });
  };

  // 返回首页
  const handleGoHome = () => {
    Taro.switchTab({
      url: '/pages/index/index',
    });
  };

  // 查看我的订单
  const handleViewOrders = () => {
    Taro.redirectTo({
      url: '/pages/order/list',
    });
  };

  // 重新支付
  const handleRetryPay = () => {
    Taro.navigateBack();
  };

  const handleMockPaySuccess = async () => {
    if (!orderId) return;
    try {
      await api.mockPaymentSuccess(orderId);
      setStatus('success');
      Taro.showToast({ title: '已模拟支付成功', icon: 'none' });
    } catch (e) {}
  };

  if (loading) {
    return (
      <View className="order-result loading">
        <Text>处理中...</Text>
      </View>
    );
  }

  return (
    <View className="order-result">
      <View className={`result-header ${status}`}>
        <View className="icon-wrapper">
          {status === 'success' && (
            <Image
              className="result-icon"
              src="https://img.icons8.com/fluency/96/checkmark.png"
            />
          )}
          {status === 'pending' && (
            <Image
              className="result-icon"
              src="https://img.icons8.com/fluency/96/hourglass.png"
            />
          )}
          {status === 'failed' && (
            <Image
              className="result-icon"
              src="https://img.icons8.com/fluency/96/cancel.png"
            />
          )}
        </View>
        <Text className="result-title">
          {status === 'success' && '支付成功'}
          {status === 'pending' && '支付处理中'}
          {status === 'failed' && '支付失败'}
        </Text>
        {order && status === 'success' && (
          <Text className="result-amount">¥{order.totalAmount.toFixed(2)}</Text>
        )}
      </View>

      {order && (
        <View className="order-info">
          <View className="info-item">
            <Text className="label">订单编号</Text>
            <Text className="value">{order.orderNo}</Text>
          </View>
          <View className="info-item">
            <Text className="label">活动名称</Text>
            <Text className="value">{order.activity.title}</Text>
          </View>
          <View className="info-item">
            <Text className="label">活动时间</Text>
            <Text className="value">
              {new Date(order.activity.startTime).toLocaleDateString()}
            </Text>
          </View>
        </View>
      )}

      {status === 'success' && (
        <View className="tips">
          <View className="tip-item">
            <Text className="tip-icon">1</Text>
            <View className="tip-content">
              <Text className="tip-title">活动前准备</Text>
              <Text className="tip-desc">请提前查看活动详情，做好出行准备</Text>
            </View>
          </View>
          <View className="tip-item">
            <Text className="tip-icon">2</Text>
            <View className="tip-content">
              <Text className="tip-title">活动签到</Text>
              <Text className="tip-desc">活动当天出示核销码进行签到</Text>
            </View>
          </View>
          <View className="tip-item">
            <Text className="tip-icon">3</Text>
            <View className="tip-content">
              <Text className="tip-title">保险保障</Text>
              <Text className="tip-desc">您的保险将在活动期间自动生效</Text>
            </View>
          </View>
        </View>
      )}

      {status === 'pending' && (
        <View className="pending-tips">
          <Text className="pending-text">
            支付结果确认中，请稍后查看订单状态
          </Text>
          <Text className="pending-sub">如有问题请联系客服</Text>
        </View>
      )}

      {status === 'failed' && (
        <View className="failed-tips">
          <Text className="failed-text">
            支付未成功，请重新尝试或联系客服
          </Text>
        </View>
      )}

      <View className="actions">
        {status === 'success' && (
          <>
            <Button
              type="primary"
              className="action-btn primary"
              onClick={handleViewOrder}
            >
              查看订单
            </Button>
            <Button
              className="action-btn secondary"
              onClick={handleGoHome}
            >
              返回首页
            </Button>
          </>
        )}
        {status === 'pending' && (
          <>
            <Button
              type="primary"
              className="action-btn primary"
              onClick={handleViewOrders}
            >
              查看我的订单
            </Button>
            <Button
              className="action-btn secondary"
              onClick={handleGoHome}
            >
              返回首页
            </Button>
            {process.env.NODE_ENV === 'development' && (
              <Button
                className="action-btn secondary"
                onClick={handleMockPaySuccess}
              >
                模拟支付成功
              </Button>
            )}
          </>
        )}
        {status === 'failed' && (
          <>
            <Button
              type="primary"
              className="action-btn primary"
              onClick={handleRetryPay}
            >
              重新支付
            </Button>
            <Button
              className="action-btn secondary"
              onClick={handleGoHome}
            >
              返回首页
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
