import { View, Text, Image, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import api from '../../services/request';
import './index.scss';

type CircleCategory = 'ALL' | 'HIKING' | 'CYCLING' | 'CLIMBING' | 'CAMPING' | 'RUNNING' | 'OTHER';

interface CircleData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  coverUrl: string | null;
  category: CircleCategory;
  memberCount: number;
  postCount: number;
  creator: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

const CATEGORIES: { key: CircleCategory; label: string; icon: string }[] = [
  { key: 'ALL', label: '全部', icon: '🌟' },
  { key: 'HIKING', label: '徒步', icon: '🥾' },
  { key: 'CYCLING', label: '骑行', icon: '🚴' },
  { key: 'CLIMBING', label: '攀岩', icon: '🧗' },
  { key: 'CAMPING', label: '露营', icon: '⛺' },
  { key: 'RUNNING', label: '跑步', icon: '🏃' },
  { key: 'OTHER', label: '其他', icon: '🎯' },
];

export default function CircleIndex() {
  const [activeCategory, setActiveCategory] = useState<CircleCategory>('ALL');
  const [circles, setCircles] = useState<CircleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [keyword, setKeyword] = useState('');

  // 加载圈子列表
  const loadCircles = useCallback(
    async (refresh = false) => {
      if (loading) return;
      if (!refresh && !hasMore) return;

      setLoading(true);
      try {
        const params: any = {};
        if (activeCategory !== 'ALL') {
          params.category = activeCategory;
        }
        if (keyword.trim()) {
          params.keyword = keyword.trim();
        }
        if (!refresh && cursor) {
          params.cursor = cursor;
        }

        const result = await api.getCircles(params);
        const newCircles = result.circles || [];

        if (refresh) {
          setCircles(newCircles);
        } else {
          setCircles((prev) => [...prev, ...newCircles]);
        }

        setCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);
      } catch (error) {
        console.error('Failed to load circles:', error);
      } finally {
        setLoading(false);
        Taro.stopPullDownRefresh();
      }
    },
    [activeCategory, keyword, cursor, hasMore, loading]
  );

  // 页面显示时加载
  useDidShow(() => {
    loadCircles(true);
  });

  // 下拉刷新
  usePullDownRefresh(() => {
    loadCircles(true);
  });

  // 切换分类
  const handleCategoryChange = (category: CircleCategory) => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    setCircles([]);
    setCursor(null);
    setHasMore(true);
    setTimeout(() => loadCircles(true), 100);
  };

  // 搜索
  const handleSearch = () => {
    setCircles([]);
    setCursor(null);
    setHasMore(true);
    loadCircles(true);
  };

  // 跳转到圈子详情
  const goToDetail = (circleId: string) => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${circleId}` });
  };

  // 滚动加载更多
  const handleScrollToLower = () => {
    if (hasMore && !loading) {
      loadCircles();
    }
  };

  return (
    <View className="circle-index">
      {/* 搜索栏 */}
      <View className="search-bar">
        <View className="search-input-wrap">
          <Text className="search-icon">🔍</Text>
          <Input
            className="search-input"
            placeholder="搜索圈子"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={handleSearch}
          />
        </View>
      </View>

      {/* 分类标签 */}
      <ScrollView className="category-tabs" scrollX enableFlex>
        {CATEGORIES.map((cat) => (
          <View
            key={cat.key}
            className={`category-item ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat.key)}
          >
            <Text className="category-icon">{cat.icon}</Text>
            <Text className="category-label">{cat.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 圈子列表 */}
      <ScrollView
        className="circle-list"
        scrollY
        enableFlex
        onScrollToLower={handleScrollToLower}
      >
        {circles.length === 0 && !loading ? (
          <View className="empty-state">
            <Text className="empty-icon">🔮</Text>
            <Text className="empty-text">暂无圈子，快来创建第一个吧</Text>
          </View>
        ) : (
          <View className="circle-grid">
            {circles.map((circle) => (
              <View
                key={circle.id}
                className="circle-card"
                onClick={() => goToDetail(circle.id)}
              >
                <Image
                  className="circle-cover"
                  src={circle.coverUrl || 'https://img.icons8.com/color/200/groups.png'}
                  mode="aspectFill"
                />
                <View className="circle-info">
                  <View className="circle-header">
                    <Image
                      className="circle-icon"
                      src={circle.icon || 'https://img.icons8.com/color/100/groups.png'}
                      mode="aspectFill"
                    />
                    <Text className="circle-name">{circle.name}</Text>
                  </View>
                  {circle.description && (
                    <Text className="circle-desc" numberOfLines={2}>
                      {circle.description}
                    </Text>
                  )}
                  <View className="circle-stats">
                    <Text className="stat-item">{circle.memberCount} 成员</Text>
                    <Text className="stat-divider">·</Text>
                    <Text className="stat-item">{circle.postCount} 帖子</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 加载状态 */}
        {loading && (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {/* 没有更多 */}
        {!hasMore && circles.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">— 没有更多了 —</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
