import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import { Tabs } from '@nutui/nutui-react-taro';
import api from '../../services/request';
import './list.scss';

interface OrderItem {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    coverUrl: string;
    startTime: string;
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待支付', color: '#faad14' },
  PAYING: { label: '支付中', color: '#faad14' },
  PAID: { label: '已支付', color: '#52c41a' },
  CANCELLED: { label: '已取消', color: '#999' },
  REFUNDING: { label: '退款中', color: '#1890ff' },
  REFUNDED: { label: '已退款', color: '#999' },
  COMPLETED: { label: '已完成', color: '#52c41a' },
};

const TAB_LIST = [
  { title: '全部', value: '' },
  { title: '待支付', value: 'PENDING' },
  { title: '已支付', value: 'PAID' },
  { title: '已完成', value: 'COMPLETED' },
];

export default function OrderList() {
  const [activeTab, setActiveTab] = useState(0);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(
    async (refresh = false) => {
      try {
        const currentPage = refresh ? 1 : page;
        const status = TAB_LIST[activeTab].value;

        const result = await api.getOrders({
          status: status || undefined,
          page: currentPage,
          limit: 10,
        });

        const newOrders = result.items || [];

        if (refresh) {
          setOrders(newOrders);
          setPage(2);
        } else {
          setOrders((prev) => [...prev, ...newOrders]);
          setPage((prev) => prev + 1);
        }

        setHasMore(newOrders.length >= 10);
      } catch (error) {
        console.error('加载订单失败:', error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, page]
  );

  useEffect(() => {
    setLoading(true);
    setOrders([]);
    setPage(1);
    setHasMore(true);
    loadOrders(true);
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadOrders(false);
    }
  };

  const handleOrderClick = (orderId: string) => {
    Taro.navigateTo({
      url: `/pages/order/detail?orderId=${orderId}`,
    });
  };

  const handlePayClick = (e: any, orderId: string) => {
    e.stopPropagation();
    Taro.navigateTo({
      url: `/pages/order/confirm?orderId=${orderId}`,
    });
  };

  const handleCancelClick = async (e: any, orderId: string) => {
    e.stopPropagation();
    const result = await Taro.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
    });

    if (result.confirm) {
      try {
        await api.cancelOrder(orderId);
        Taro.showToast({ title: '订单已取消', icon: 'success' });
        loadOrders(true);
      } catch (error: any) {
        Taro.showToast({ title: error.message || '取消失败', icon: 'none' });
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const renderOrderCard = (order: OrderItem) => {
    const statusInfo = STATUS_MAP[order.status] || { label: '未知', color: '#999' };

    return (
      <View
        key={order.id}
        className="order-card"
        onClick={() => handleOrderClick(order.id)}
      >
        <View className="card-header">
          <Text className="order-no">订单号: {order.orderNo}</Text>
          <Text className="status" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </Text>
        </View>

        <View className="card-body">
          <Image
            className="cover"
            src={order.activity.coverUrl}
            mode="aspectFill"
          />
          <View className="info">
            <Text className="title">{order.activity.title}</Text>
            <Text className="date">活动时间: {formatDate(order.activity.startTime)}</Text>
          </View>
        </View>

        <View className="card-footer">
          <Text className="amount">
            实付: <Text className="price">¥{order.totalAmount.toFixed(2)}</Text>
          </Text>
          <View className="actions">
            {order.status === 'PENDING' && (
              <>
                <View
                  className="btn btn-default"
                  onClick={(e) => handleCancelClick(e, order.id)}
                >
                  取消
                </View>
                <View
                  className="btn btn-primary"
                  onClick={(e) => handlePayClick(e, order.id)}
                >
                  去支付
                </View>
              </>
            )}
            {order.status === 'PAID' && (
              <View
                className="btn btn-primary"
                onClick={() => handleOrderClick(order.id)}
              >
                查看详情
              </View>
            )}
            {order.status === 'COMPLETED' && (
              <View
                className="btn btn-default"
                onClick={() => handleOrderClick(order.id)}
              >
                查看详情
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="order-list">
      <View className="tabs-wrapper">
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as number)}
        >
          {TAB_LIST.map((tab, index) => (
            <Tabs.TabPane key={index} title={tab.title} />
          ))}
        </Tabs>
      </View>

      <ScrollView
        className="order-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
        onScrollToLower={handleLoadMore}
      >
        {loading && orders.length === 0 ? (
          <View className="loading">
            <Text>加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="empty">
            <Image
              className="empty-icon"
              src="https://img.icons8.com/fluency/96/nothing-found.png"
            />
            <Text className="empty-text">暂无订单</Text>
          </View>
        ) : (
          <>
            {orders.map(renderOrderCard)}
            {!hasMore && (
              <View className="no-more">
                <Text>没有更多了</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
