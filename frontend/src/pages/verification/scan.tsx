import { useState, useEffect } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Button } from '@nutui/nutui-react-taro';
import api from '../../services/request';
import './scan.scss';

interface VerificationResult {
  success: boolean;
  order: {
    id: string;
    orderNo: string;
    contactName: string;
    userName: string;
    activity: {
      id: string;
      title: string;
      startTime: string;
    };
    verifiedAt: string;
  };
}

interface ActivityStats {
  activity: {
    id: string;
    title: string;
    startTime: string;
    maxPeople: number;
  };
  stats: {
    total: number;
    verified: number;
    pending: number;
    verifiedRate: number;
  };
}

export default function VerificationScan() {
  const router = useRouter();
  const activityId = router.params.activityId;

  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [orderNo, setOrderNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activityId) {
      loadStats();
    }
  }, [activityId]);

  const loadStats = async () => {
    if (!activityId) return;
    try {
      const data = await api.getActivityVerificationStats(activityId);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleScan = () => {
    Taro.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: async (res) => {
        const code = res.result;
        await verifyByCode(code);
      },
      fail: (err) => {
        if (err.errMsg.includes('cancel')) {
          return;
        }
        setError('扫码失败，请重试');
      },
    });
  };

  const verifyByCode = async (code: string) => {
    try {
      setLoading(true);
      setError('');
      setResult(null);

      const data = await api.verifyOrder(code);
      setResult(data);

      // 刷新统计
      if (activityId) {
        loadStats();
      }

      Taro.vibrateShort({ type: 'heavy' });
    } catch (err: any) {
      setError(err.message || '核销失败');
      Taro.vibrateShort({ type: 'light' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = async () => {
    if (!orderNo.trim()) {
      setError('请输入订单号');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);

      const data = await api.verifyByOrderNo(orderNo.trim());
      setResult(data);

      // 刷新统计
      if (activityId) {
        loadStats();
      }

      Taro.vibrateShort({ type: 'heavy' });
      setOrderNo('');
    } catch (err: any) {
      setError(err.message || '核销失败');
      Taro.vibrateShort({ type: 'light' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const goToList = () => {
    if (activityId) {
      Taro.navigateTo({
        url: `/pages/verification/list?activityId=${activityId}`,
      });
    }
  };

  return (
    <View className="verification-scan-page">
      {/* 活动统计 */}
      {stats && (
        <View className="stats-card">
          <Text className="activity-title">{stats.activity.title}</Text>
          <View className="stats-row">
            <View className="stat-item">
              <Text className="value">{stats.stats.total}</Text>
              <Text className="label">总报名</Text>
            </View>
            <View className="stat-item verified">
              <Text className="value">{stats.stats.verified}</Text>
              <Text className="label">已核销</Text>
            </View>
            <View className="stat-item pending">
              <Text className="value">{stats.stats.pending}</Text>
              <Text className="label">待核销</Text>
            </View>
            <View className="stat-item">
              <Text className="value">{stats.stats.verifiedRate}%</Text>
              <Text className="label">核销率</Text>
            </View>
          </View>
          <View className="view-list" onClick={goToList}>
            <Text>查看核销列表</Text>
            <Text className="arrow">▶</Text>
          </View>
        </View>
      )}

      {/* 模式切换 */}
      <View className="mode-tabs">
        <View
          className={`tab ${mode === 'scan' ? 'active' : ''}`}
          onClick={() => setMode('scan')}
        >
          <Text>扫码核销</Text>
        </View>
        <View
          className={`tab ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          <Text>手动输入</Text>
        </View>
      </View>

      {/* 核销操作区 */}
      <View className="action-area">
        {mode === 'scan' ? (
          <View className="scan-mode">
            <View className="scan-icon" onClick={handleScan}>
              <Text className="icon-text">📷</Text>
            </View>
            <Text className="hint">点击上方图标扫描用户核销码</Text>
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={handleScan}
            >
              开始扫码
            </Button>
          </View>
        ) : (
          <View className="manual-mode">
            <Input
              className="order-input"
              placeholder="请输入订单号"
              value={orderNo}
              onInput={(e) => setOrderNo(e.detail.value)}
            />
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              disabled={!orderNo.trim()}
              onClick={handleManualVerify}
            >
              确认核销
            </Button>
          </View>
        )}
      </View>

      {/* 核销结果 */}
      {result && (
        <View className="result-card success">
          <View className="result-icon">✓</View>
          <Text className="result-title">核销成功</Text>
          <View className="result-info">
            <View className="info-row">
              <Text className="label">联系人</Text>
              <Text className="value">{result.order.contactName}</Text>
            </View>
            <View className="info-row">
              <Text className="label">用户昵称</Text>
              <Text className="value">{result.order.userName}</Text>
            </View>
            <View className="info-row">
              <Text className="label">订单号</Text>
              <Text className="value">{result.order.orderNo}</Text>
            </View>
            <View className="info-row">
              <Text className="label">核销时间</Text>
              <Text className="value">{formatTime(result.order.verifiedAt)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 错误提示 */}
      {error && (
        <View className="result-card error">
          <View className="result-icon">✕</View>
          <Text className="result-title">核销失败</Text>
          <Text className="error-message">{error}</Text>
        </View>
      )}

      {/* 操作提示 */}
      <View className="tips">
        <Text className="tips-title">核销说明</Text>
        <Text className="tips-content">1. 请确认用户出示的是有效的核销码</Text>
        <Text className="tips-content">2. 每个订单只能核销一次</Text>
        <Text className="tips-content">3. 核销后用户报名状态将更新为"已签到"</Text>
      </View>
    </View>
  );
}
