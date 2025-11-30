import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import api from '../../services/request';
import './list.scss';

interface VerificationItem {
  id: string;
  orderNo: string;
  contactName: string;
  contactPhone: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string;
    phone: string;
  };
  paidAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export default function VerificationList() {
  const router = useRouter();
  const activityId = router.params.activityId as string;

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<VerificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');

  useEffect(() => {
    if (activityId) {
      loadList();
    }
  }, [activityId, filter]);

  const loadList = async () => {
    try {
      setLoading(true);
      const data = await api.getActivityVerifications(activityId, filter);
      setList(data);
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  const goToScan = () => {
    Taro.navigateTo({
      url: `/pages/verification/scan?activityId=${activityId}`,
    });
  };

  const pendingCount = list.filter((item) => !item.verifiedAt).length;
  const verifiedCount = list.filter((item) => item.verifiedAt).length;

  return (
    <View className="verification-list-page">
      {/* 过滤标签 */}
      <View className="filter-tabs">
        <View
          className={`tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <Text>全部 ({list.length})</Text>
        </View>
        <View
          className={`tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          <Text>待核销 ({filter === 'all' ? pendingCount : filter === 'pending' ? list.length : 0})</Text>
        </View>
        <View
          className={`tab ${filter === 'verified' ? 'active' : ''}`}
          onClick={() => setFilter('verified')}
        >
          <Text>已核销 ({filter === 'all' ? verifiedCount : filter === 'verified' ? list.length : 0})</Text>
        </View>
      </View>

      {/* 列表 */}
      <ScrollView className="list-container" scrollY>
        {loading ? (
          <View className="loading">
            <Text>加载中...</Text>
          </View>
        ) : list.length === 0 ? (
          <View className="empty">
            <Text>暂无数据</Text>
          </View>
        ) : (
          list.map((item) => (
            <View key={item.id} className="list-item">
              <View className="user-info">
                <Image
                  className="avatar"
                  src={item.user.avatarUrl || '/assets/default-avatar.png'}
                  mode="aspectFill"
                />
                <View className="info">
                  <Text className="name">{item.contactName}</Text>
                  <Text className="phone">{maskPhone(item.contactPhone)}</Text>
                </View>
                <View className={`status ${item.verifiedAt ? 'verified' : 'pending'}`}>
                  <Text>{item.verifiedAt ? '已核销' : '待核销'}</Text>
                </View>
              </View>
              <View className="order-info">
                <View className="info-row">
                  <Text className="label">订单号</Text>
                  <Text className="value">{item.orderNo}</Text>
                </View>
                <View className="info-row">
                  <Text className="label">支付时间</Text>
                  <Text className="value">{formatTime(item.paidAt)}</Text>
                </View>
                {item.verifiedAt && (
                  <View className="info-row">
                    <Text className="label">核销时间</Text>
                    <Text className="value verified">{formatTime(item.verifiedAt)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 扫码按钮 */}
      <View className="scan-btn" onClick={goToScan}>
        <Text className="icon">📷</Text>
        <Text>扫码核销</Text>
      </View>
    </View>
  );
}
