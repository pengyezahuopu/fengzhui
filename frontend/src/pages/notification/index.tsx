import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import api from '../../services/request';
import './index.scss';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  targetId: string | null;
  targetType: string | null;
  isRead: boolean;
  createdAt: string;
}

// 通知类型图标映射
const TYPE_ICONS: Record<string, string> = {
  LIKE: '❤️',
  COMMENT: '💬',
  FOLLOW: '👤',
  BADGE: '🏅',
  ACTIVITY: '🏃',
  SYSTEM: '📢',
};

// 通知类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  LIKE: '#ff4d4f',
  COMMENT: '#1890ff',
  FOLLOW: '#52c41a',
  BADGE: '#faad14',
  ACTIVITY: '#722ed1',
  SYSTEM: '#666',
};

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadNotifications = useCallback(
    async (refresh = false) => {
      if (loading && !refresh) return;
      if (!refresh && !hasMore) return;

      setLoading(true);
      try {
        const result = await api.getNotifications({
          cursor: refresh ? undefined : cursor || undefined,
          limit: 20,
        });

        const newNotifications = result.notifications || [];

        if (refresh) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }

        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        setLoading(false);
      }
    },
    [cursor, hasMore, loading]
  );

  useDidShow(() => {
    loadNotifications(true);
  });

  const handleNotificationClick = async (notification: Notification) => {
    // 标记为已读
    if (!notification.isRead) {
      try {
        await api.markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // 跳转到目标页面
    if (notification.targetId && notification.targetType) {
      switch (notification.targetType) {
        case 'post':
          Taro.navigateTo({ url: `/pages/post/detail?id=${notification.targetId}` });
          break;
        case 'user':
          Taro.navigateTo({ url: `/pages/user/profile?id=${notification.targetId}` });
          break;
        case 'activity':
          Taro.navigateTo({ url: `/pages/activity/detail?id=${notification.targetId}` });
          break;
        case 'badge':
          // 可以跳转到勋章详情或勋章墙
          break;
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      Taro.showToast({ title: '全部已读', icon: 'success' });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearRead = async () => {
    try {
      await api.clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      Taro.showToast({ title: '已清除', icon: 'success' });
    } catch (error) {
      console.error('Failed to clear read notifications:', error);
    }
  };

  const handleScrollToLower = () => {
    if (hasMore && !loading) {
      loadNotifications();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View className="notification-page">
      {/* 操作栏 */}
      <View className="action-bar">
        <Text className="unread-count">未读 {unreadCount} 条</Text>
        <View className="actions">
          <View className="action-btn" onClick={handleMarkAllAsRead}>
            <Text className="action-text">全部已读</Text>
          </View>
          <View className="action-btn" onClick={handleClearRead}>
            <Text className="action-text">清除已读</Text>
          </View>
        </View>
      </View>

      {/* 通知列表 */}
      <ScrollView
        scrollY
        className="notification-list"
        enableFlex
        onScrollToLower={handleScrollToLower}
      >
        {loading && notifications.length === 0 ? (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-icon">🔔</Text>
            <Text className="empty-text">暂无通知</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <View
              key={notification.id}
              className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <View
                className="type-icon"
                style={{ backgroundColor: TYPE_COLORS[notification.type] + '20' }}
              >
                <Text className="icon-text">{TYPE_ICONS[notification.type] || '📌'}</Text>
              </View>
              <View className="notification-content">
                <Text className="notification-title">{notification.title}</Text>
                {notification.content && (
                  <Text className="notification-desc">{notification.content}</Text>
                )}
                <Text className="notification-time">{formatTime(notification.createdAt)}</Text>
              </View>
              {!notification.isRead && <View className="unread-dot" />}
            </View>
          ))
        )}

        {loading && notifications.length > 0 && (
          <View className="loading-more">
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {!hasMore && notifications.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">— 没有更多了 —</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
