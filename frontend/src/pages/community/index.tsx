import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { PostCard, PostData } from '../../components/social';
import api from '../../services/request';
import './index.scss';

type FeedType = 'recommend' | 'following';

export default function CommunityIndex() {
  const [feedType, setFeedType] = useState<FeedType>('recommend');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // 加载数据
  const loadPosts = useCallback(
    async (refresh = false) => {
      if (loading) return;
      if (!refresh && !hasMore) return;

      setLoading(true);
      try {
        // 关注流需要登录
        if (feedType === 'following') {
          const uid = Taro.getStorageSync('userId');
          if (!uid) {
            Taro.showToast({ title: '请先登录以查看关注', icon: 'none' });
            setFeedType('recommend');
          }
        }

        const result =
          feedType === 'recommend'
            ? await api.getRecommendFeed(refresh ? undefined : cursor || undefined)
            : await api.getPersonalFeed(refresh ? undefined : cursor || undefined);

        const newPosts = Array.isArray(result.posts) ? result.posts : [];

        if (refresh) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }

        setCursor(result.nextCursor || null);
        setHasMore(!!result.nextCursor);
      } catch (error: any) {
        console.error('Failed to load posts:', error);
        Taro.showToast({ title: error?.message || '动态加载失败', icon: 'none' });
        // 发生错误时不再继续上拉加载，避免重复触发
        setHasMore(false);
      } finally {
        setLoading(false);
        Taro.stopPullDownRefresh();
      }
    },
    [feedType, cursor, hasMore, loading]
  );

  // 页面显示时加载
  useDidShow(() => {
    loadPosts(true);
  });

  // 下拉刷新
  usePullDownRefresh(() => {
    loadPosts(true);
  });

  // 切换 Feed 类型
  const switchFeedType = (type: FeedType) => {
    if (type === feedType) return;
    setFeedType(type);
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    // 延迟加载，让状态更新
    setTimeout(() => {
      loadPosts(true);
    }, 100);
  };

  // 处理点赞
  const handleLike = async (postId: string, liked: boolean) => {
    try {
      if (liked) {
        await api.likePost(postId);
      } else {
        await api.unlikePost(postId);
      }
    } catch (error) {
      console.error('Like failed:', error);
    }
  };

  // 跳转到评论
  const handleComment = (postId: string) => {
    Taro.navigateTo({ url: `/pages/post/detail?id=${postId}` });
  };

  // 跳转到用户主页
  const handleUserClick = (userId: string) => {
    Taro.navigateTo({ url: `/pages/user/profile?id=${userId}` });
  };

  // 跳转到发布页
  const goToPublish = () => {
    Taro.navigateTo({ url: '/pages/post/publish' });
  };

  // 滚动到底部加载更多
  const handleScrollToLower = () => {
    if (hasMore && !loading) {
      loadPosts();
    }
  };

  return (
    <View className="community-page">
      {/* 顶部 Tab */}
      <View className="feed-tabs">
        <View
          className={`tab-item ${feedType === 'recommend' ? 'active' : ''}`}
          onClick={() => switchFeedType('recommend')}
        >
          <Text className="tab-text">推荐</Text>
          {feedType === 'recommend' && <View className="tab-indicator" />}
        </View>
        <View
          className={`tab-item ${feedType === 'following' ? 'active' : ''}`}
          onClick={() => switchFeedType('following')}
        >
          <Text className="tab-text">关注</Text>
          {feedType === 'following' && <View className="tab-indicator" />}
        </View>
      </View>

      {/* Feed 列表 */}
      <ScrollView
        className="feed-list"
        scrollY
        enableFlex
        onScrollToLower={handleScrollToLower}
      >
        {posts.length === 0 && !loading ? (
          <View className="empty-state">
            <Text className="empty-icon">📝</Text>
            <Text className="empty-text">
              {feedType === 'following'
                ? '还没有关注的人，去发现更多有趣的人吧'
                : '暂无动态，快来发布第一条吧'}
            </Text>
            <View className="empty-actions">
              <View className="empty-action" onClick={() => switchFeedType('recommend')}>
                <Text className="action-text">切换到推荐</Text>
              </View>
              <View className="empty-action" onClick={goToPublish}>
                <Text className="action-text">去发布</Text>
              </View>
            </View>
          </View>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onComment={handleComment}
              onUserClick={handleUserClick}
            />
          ))
        )}

        {/* 加载状态 */}
        {loading && (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {/* 没有更多 */}
        {!hasMore && posts.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">— 没有更多了 —</Text>
          </View>
        )}
      </ScrollView>

      {/* 发布按钮 */}
      <View className="publish-btn" onClick={goToPublish}>
        <Text className="publish-icon">+</Text>
      </View>
    </View>
  );
}
