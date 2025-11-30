import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Cell, Grid, Button, Progress, Tag, Loading, Empty } from '@nutui/nutui-react-taro';
import { api } from '../../../services/request';
import './index.scss';

interface DashboardData {
  overview: {
    balance: number;
    availableBalance: number;
    frozenBalance: number;
    totalIncome: number;
    totalWithdraw: number;
    pendingSettlementCount: number;
    pendingSettlementAmount: number;
    hasBankAccount: boolean;
  };
  monthlyStats: {
    income: number;
    refund: number;
    netIncome: number;
    orderCount: number;
    month: number;
    year: number;
  };
  activityStats: {
    total: number;
    active: number;
    completed: number;
    totalEnrollments: number;
    monthlyEnrollments: number;
  };
  recentActivities: Array<{
    id: string;
    title: string;
    status: string;
    startTime: string;
    currentPeople: number;
    maxPeople: number;
    price: number;
    enrollmentCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

const statusMap: Record<string, { text: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'default' }> = {
  DRAFT: { text: '草稿', type: 'default' },
  PUBLISHED: { text: '已发布', type: 'primary' },
  FULL: { text: '已满员', type: 'warning' },
  COMPLETED: { text: '已结束', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' },
};

const transactionTypeMap: Record<string, string> = {
  INCOME: '收入',
  REFUND: '退款',
  WITHDRAWAL: '提现',
  FEE: '服务费',
  SETTLEMENT: '结算',
};

export default function ClubDashboard() {
  const router = useRouter();
  const { clubId } = router.params;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useDidShow(() => {
    if (clubId) {
      loadDashboard();
    }
  });

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result = await api.getClubDashboard(clubId!);
      setData(result);
    } catch (error) {
      console.error('加载Dashboard失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View className="dashboard-loading">
        <Loading type="spinner" />
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View className="dashboard-empty">
        <Empty description="暂无数据" />
      </View>
    );
  }

  const { overview, monthlyStats, activityStats, recentActivities, recentTransactions } = data;

  return (
    <View className="club-dashboard">
      {/* 账户概览 */}
      <View className="section account-section">
        <View className="balance-card">
          <View className="balance-main">
            <Text className="label">可提现余额</Text>
            <Text className="amount">{formatAmount(overview.availableBalance)}</Text>
          </View>
          <View className="balance-actions">
            <Button
              type="primary"
              size="small"
              disabled={!overview.hasBankAccount}
              onClick={() => Taro.navigateTo({ url: `/pages/club/withdrawal/index?clubId=${clubId}` })}
            >
              提现
            </Button>
            {!overview.hasBankAccount && (
              <Text className="tip">请先设置提现账户</Text>
            )}
          </View>
        </View>

        <Grid columns={3} gap={0}>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{formatAmount(overview.totalIncome)}</Text>
              <Text className="label">累计收入</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{formatAmount(overview.totalWithdraw)}</Text>
              <Text className="label">累计提现</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{formatAmount(overview.frozenBalance)}</Text>
              <Text className="label">冻结金额</Text>
            </View>
          </Grid.Item>
        </Grid>

        {overview.pendingSettlementCount > 0 && (
          <View className="pending-settlement">
            <Text className="text">
              {overview.pendingSettlementCount} 个活动待结算，预计 {formatAmount(overview.pendingSettlementAmount)}
            </Text>
          </View>
        )}
      </View>

      {/* 本月数据 */}
      <View className="section">
        <View className="section-header">
          <Text className="title">{monthlyStats.year}年{monthlyStats.month}月数据</Text>
        </View>
        <Grid columns={4} gap={0}>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{formatAmount(monthlyStats.income)}</Text>
              <Text className="label">收入</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value danger">{formatAmount(monthlyStats.refund)}</Text>
              <Text className="label">退款</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value success">{formatAmount(monthlyStats.netIncome)}</Text>
              <Text className="label">净收入</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{monthlyStats.orderCount}</Text>
              <Text className="label">订单数</Text>
            </View>
          </Grid.Item>
        </Grid>
      </View>

      {/* 活动数据 */}
      <View className="section">
        <View className="section-header">
          <Text className="title">活动数据</Text>
          <Text
            className="action"
            onClick={() => Taro.navigateTo({ url: `/pages/club/activities/index?clubId=${clubId}` })}
          >
            全部活动 &gt;
          </Text>
        </View>
        <Grid columns={4} gap={0}>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{activityStats.total}</Text>
              <Text className="label">总活动</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value primary">{activityStats.active}</Text>
              <Text className="label">进行中</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value">{activityStats.totalEnrollments}</Text>
              <Text className="label">总报名</Text>
            </View>
          </Grid.Item>
          <Grid.Item>
            <View className="stat-item">
              <Text className="value success">{activityStats.monthlyEnrollments}</Text>
              <Text className="label">本月报名</Text>
            </View>
          </Grid.Item>
        </Grid>
      </View>

      {/* 快捷操作 */}
      <View className="section">
        <View className="section-header">
          <Text className="title">快捷操作</Text>
        </View>
        <Grid columns={4} gap={10}>
          <Grid.Item onClick={() => Taro.navigateTo({ url: `/pages/club/finance/index?clubId=${clubId}` })}>
            <View className="quick-action">
              <View className="icon">💰</View>
              <Text className="text">财务中心</Text>
            </View>
          </Grid.Item>
          <Grid.Item onClick={() => Taro.navigateTo({ url: `/pages/club/activities/index?clubId=${clubId}` })}>
            <View className="quick-action">
              <View className="icon">🎯</View>
              <Text className="text">活动管理</Text>
            </View>
          </Grid.Item>
          <Grid.Item onClick={() => Taro.navigateTo({ url: `/pages/verification/list?clubId=${clubId}` })}>
            <View className="quick-action">
              <View className="icon">✅</View>
              <Text className="text">核销管理</Text>
            </View>
          </Grid.Item>
          <Grid.Item onClick={() => Taro.navigateTo({ url: `/pages/club/settings/index?clubId=${clubId}` })}>
            <View className="quick-action">
              <View className="icon">⚙️</View>
              <Text className="text">俱乐部设置</Text>
            </View>
          </Grid.Item>
        </Grid>
      </View>

      {/* 最近活动 */}
      <View className="section">
        <View className="section-header">
          <Text className="title">最近活动</Text>
        </View>
        {recentActivities.length > 0 ? (
          <View className="activity-list">
            {recentActivities.map((activity) => (
              <View
                key={activity.id}
                className="activity-item"
                onClick={() => Taro.navigateTo({ url: `/pages/activity/detail/index?id=${activity.id}` })}
              >
                <View className="activity-info">
                  <View className="title-row">
                    <Text className="title">{activity.title}</Text>
                    <Tag type={statusMap[activity.status]?.type || 'default'}>
                      {statusMap[activity.status]?.text || activity.status}
                    </Tag>
                  </View>
                  <View className="meta">
                    <Text className="time">{formatDate(activity.startTime)}</Text>
                    <Text className="people">
                      {activity.currentPeople}/{activity.maxPeople}人
                    </Text>
                    <Text className="price">{formatAmount(activity.price)}</Text>
                  </View>
                  <Progress
                    percent={Math.min(100, (activity.currentPeople / activity.maxPeople) * 100)}
                    showText={false}
                    strokeWidth="4"
                    color={activity.currentPeople >= activity.maxPeople ? '#f5a623' : '#4a90e2'}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Empty description="暂无活动" imageSize={80} />
        )}
      </View>

      {/* 最近流水 */}
      <View className="section">
        <View className="section-header">
          <Text className="title">最近流水</Text>
          <Text
            className="action"
            onClick={() => Taro.navigateTo({ url: `/pages/club/finance/index?clubId=${clubId}` })}
          >
            查看全部 &gt;
          </Text>
        </View>
        {recentTransactions.length > 0 ? (
          <View className="transaction-list">
            {recentTransactions.map((tx) => (
              <View key={tx.id} className="transaction-item">
                <View className="tx-info">
                  <Text className="type">{transactionTypeMap[tx.type] || tx.type}</Text>
                  <Text className="desc">{tx.description}</Text>
                </View>
                <View className="tx-amount">
                  <Text className={`amount ${tx.amount >= 0 ? 'income' : 'expense'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatAmount(tx.amount)}
                  </Text>
                  <Text className="time">{formatDate(tx.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Empty description="暂无流水" imageSize={80} />
        )}
      </View>
    </View>
  );
}
