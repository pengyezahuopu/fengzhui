import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import api from '../../services/request';
import './detail.scss';

interface OrderDetail {
  id: string;
  orderNo: string;
  amount: number;
  insuranceFee: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  verifyCode: string | null;
  activity: {
    id: string;
    title: string;
    coverUrl: string;
    startTime: string;
    endTime: string;
    club: {
      id: string;
      name: string;
      logo: string;
    };
  };
  insurance: {
    id: string;
    insuredName: string;
    insuredPhone: string;
    status: string;
    policyNo: string | null;
    product: {
      name: string;
      provider: string;
    };
  } | null;
  payment: {
    id: string;
    status: string;
    transactionId: string | null;
  } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: '待支付', color: '#faad14', bgColor: '#fffbe6' },
  PAYING: { label: '支付中', color: '#faad14', bgColor: '#fffbe6' },
  PAID: { label: '已支付', color: '#52c41a', bgColor: '#f6ffed' },
  CANCELLED: { label: '已取消', color: '#999', bgColor: '#f5f5f5' },
  REFUNDING: { label: '退款中', color: '#1890ff', bgColor: '#e6f7ff' },
  REFUNDED: { label: '已退款', color: '#999', bgColor: '#f5f5f5' },
  COMPLETED: { label: '已完成', color: '#52c41a', bgColor: '#f6ffed' },
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId } = router.params;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!orderId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    const loadOrder = async () => {
      try {
        const orderData = await api.getOrderDetail(orderId);
        setOrder(orderData);
      } catch (error) {
        console.error('加载订单失败:', error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handleViewQRCode = () => {
    Taro.navigateTo({
      url: `/pages/order/qrcode?orderId=${orderId}`,
    });
  };

  const handleCancelOrder = async () => {
    const result = await Taro.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
    });

    if (result.confirm) {
      try {
        await api.cancelOrder(orderId!);
        Taro.showToast({ title: '订单已取消', icon: 'success' });
        // 刷新订单详情
        const orderData = await api.getOrderDetail(orderId!);
        setOrder(orderData);
      } catch (error: any) {
        Taro.showToast({ title: error.message || '取消失败', icon: 'none' });
      }
    }
  };

  const handleContactClub = () => {
    Taro.showToast({ title: '功能开发中', icon: 'none' });
  };

  if (loading) {
    return (
      <View className="order-detail loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="order-detail error">
        <Text>订单不存在</Text>
      </View>
    );
  }

  const statusInfo = STATUS_MAP[order.status] || { label: '未知', color: '#999', bgColor: '#f5f5f5' };

  return (
    <View className="order-detail">
      {/* 状态头部 */}
      <View className="status-header" style={{ background: statusInfo.bgColor }}>
        <Text className="status-label" style={{ color: statusInfo.color }}>
          {statusInfo.label}
        </Text>
        {(order.status === 'PAID' || order.status === 'COMPLETED') && (
          <Text className="status-desc">请在活动当天出示核销码签到</Text>
        )}
        {order.status === 'PENDING' && (
          <Text className="status-desc">请尽快完成支付，超时订单将自动取消</Text>
        )}
      </View>

      {/* 活动信息 */}
      <View className="section activity-section">
        <View className="activity-card">
          <Image className="cover" src={order.activity.coverUrl} mode="aspectFill" />
          <View className="info">
            <Text className="title">{order.activity.title}</Text>
            <Text className="date">
              {formatDate(order.activity.startTime).split(' ')[0]}
            </Text>
            <View className="club">
              <Image className="club-logo" src={order.activity.club.logo} />
              <Text className="club-name">{order.activity.club.name}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 保险信息 */}
      {order.insurance && (
        <View className="section insurance-section">
          <View className="section-title">保险信息</View>
          <View className="info-item">
            <Text className="label">保险产品</Text>
            <Text className="value">{order.insurance.product.name}</Text>
          </View>
          <View className="info-item">
            <Text className="label">承保公司</Text>
            <Text className="value">{order.insurance.product.provider}</Text>
          </View>
          <View className="info-item">
            <Text className="label">被保险人</Text>
            <Text className="value">{order.insurance.insuredName}</Text>
          </View>
          <View className="info-item">
            <Text className="label">联系电话</Text>
            <Text className="value">{order.insurance.insuredPhone}</Text>
          </View>
          {order.insurance.policyNo && (
            <View className="info-item">
              <Text className="label">保单号</Text>
              <Text className="value">{order.insurance.policyNo}</Text>
            </View>
          )}
        </View>
      )}

      {/* 费用明细 */}
      <View className="section fee-section">
        <View className="section-title">费用明细</View>
        <View className="info-item">
          <Text className="label">活动费用</Text>
          <Text className="value">¥{order.amount.toFixed(2)}</Text>
        </View>
        {order.insuranceFee > 0 && (
          <View className="info-item">
            <Text className="label">保险费用</Text>
            <Text className="value">¥{order.insuranceFee.toFixed(2)}</Text>
          </View>
        )}
        <View className="info-item total">
          <Text className="label">实付金额</Text>
          <Text className="value price">¥{order.totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      {/* 订单信息 */}
      <View className="section order-section">
        <View className="section-title">订单信息</View>
        <View className="info-item">
          <Text className="label">订单编号</Text>
          <Text className="value">{order.orderNo}</Text>
        </View>
        <View className="info-item">
          <Text className="label">创建时间</Text>
          <Text className="value">{formatDate(order.createdAt)}</Text>
        </View>
        {order.paidAt && (
          <View className="info-item">
            <Text className="label">支付时间</Text>
            <Text className="value">{formatDate(order.paidAt)}</Text>
          </View>
        )}
        {order.payment?.transactionId && (
          <View className="info-item">
            <Text className="label">支付流水号</Text>
            <Text className="value small">{order.payment.transactionId}</Text>
          </View>
        )}
      </View>

      {/* 底部操作 */}
      <View className="bottom-actions">
        {(order.status === 'PAID' || order.status === 'COMPLETED') && (
          <Button
            type="primary"
            className="action-btn primary"
            onClick={handleViewQRCode}
          >
            查看核销码
          </Button>
        )}
        {order.status === 'PENDING' && (
          <Button
            className="action-btn secondary"
            onClick={handleCancelOrder}
          >
            取消订单
          </Button>
        )}
        <Button className="action-btn text" onClick={handleContactClub}>
          联系俱乐部
        </Button>
      </View>
    </View>
  );
}
