import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { PostCard, PostData } from '../../components/social';
import api from '../../services/request';
import './profile.scss';

interface UserProfile {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  leaderProfile?: {
    id: string;
    bio: string | null;
    specialties: string[];
  } | null;
}

interface UserStats {
  activityCount: number;
  totalDistance: number;
  totalElevation: number;
  postCount: number;
  badgeCount: number;
  circleCount: number;
  photoCount: number;
}

export default function UserProfilePage() {
  const router = useRouter();
  const userId = router.params.id || '';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [following, setFollowing] = useState(false);

  // 加载用户资料
  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await api.getUserProfile(userId);
      setProfile(result);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, [userId]);

  // 加载用户统计
  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await api.getUserStats(userId);
      setStats(result);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [userId]);

  // 加载用户帖子
  const loadPosts = useCallback(
    async (refresh = false) => {
      if (!userId) return;
      if (postLoading) return;
      if (!refresh && !hasMore) return;

      setPostLoading(true);
      try {
        const result = await api.getUserPosts(
          userId,
          refresh ? undefined : cursor || undefined
        );
        const newPosts = result.posts || [];

        if (refresh) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }

        setCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);
      } catch (error) {
        console.error('Failed to load posts:', error);
      } finally {
        setPostLoading(false);
      }
    },
    [userId, cursor, hasMore, postLoading]
  );

  // 页面显示时加载
  useDidShow(() => {
    setLoading(true);
    Promise.all([loadProfile(), loadStats(), loadPosts(true)]).finally(() => {
      setLoading(false);
    });
  });

  // 关注/取消关注
  const handleFollowToggle = async () => {
    if (!profile || following) return;

    setFollowing(true);
    try {
      if (profile.isFollowing) {
        await api.unfollowUser(userId);
        Taro.showToast({ title: '已取消关注', icon: 'success' });
      } else {
        await api.followUser(userId);
        Taro.showToast({ title: '关注成功', icon: 'success' });
      }
      // 刷新资料
      loadProfile();
    } catch (error: any) {
      Taro.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      setFollowing(false);
    }
  };

  // 处理帖子点赞
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

  // 跳转到帖子详情
  const handleComment = (postId: string) => {
    Taro.navigateTo({ url: `/pages/post/detail?id=${postId}` });
  };

  // 跳转到用户主页
  const handleUserClick = (id: string) => {
    if (id !== userId) {
      Taro.navigateTo({ url: `/pages/user/profile?id=${id}` });
    }
  };

  // 跳转到关注/粉丝列表
  const goToFollowList = (type: 'followers' | 'following') => {
    Taro.navigateTo({ url: `/pages/user/follow-list?id=${userId}&type=${type}` });
  };

  // 滚动加载更多
  const handleScrollToLower = () => {
    if (hasMore && !postLoading) {
      loadPosts();
    }
  };

  if (loading && !profile) {
    return (
      <View className="user-profile loading">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="user-profile error">
        <Text className="error-text">用户不存在</Text>
      </View>
    );
  }

  const currentUserId = Taro.getStorageSync('userId');
  const isMe = currentUserId === userId;

  return (
    <View className="user-profile">
      {/* 用户头部信息 */}
      <View className="profile-header">
        <Image
          className="user-avatar"
          src={profile.avatarUrl || 'https://img.icons8.com/ios-filled/200/user-male-circle.png'}
          mode="aspectFill"
        />
        <View className="user-info">
          <Text className="user-name">{profile.nickname}</Text>
          {profile.leaderProfile && (
            <View className="leader-badge">
              <Text className="badge-text">领队认证</Text>
            </View>
          )}
        </View>

        {!isMe && (
          <View
            className={`follow-btn ${profile.isFollowing ? 'following' : ''}`}
            onClick={handleFollowToggle}
          >
            <Text className="follow-text">
              {following ? '处理中' : profile.isFollowing ? '已关注' : '关注'}
            </Text>
          </View>
        )}
      </View>

      {/* 统计数据 */}
      <View className="stats-row">
        <View className="stat-item" onClick={() => goToFollowList('followers')}>
          <Text className="stat-value">{profile.followerCount}</Text>
          <Text className="stat-label">粉丝</Text>
        </View>
        <View className="stat-item" onClick={() => goToFollowList('following')}>
          <Text className="stat-value">{profile.followingCount}</Text>
          <Text className="stat-label">关注</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-value">{profile.postCount}</Text>
          <Text className="stat-label">帖子</Text>
        </View>
      </View>

      {/* 活动统计卡片 */}
      {stats && (
        <View className="activity-stats">
          <View className="stats-title">户外数据</View>
          <View className="stats-grid">
            <View className="stat-card">
              <Text className="card-value">{stats.activityCount}</Text>
              <Text className="card-label">参与活动</Text>
            </View>
            <View className="stat-card">
              <Text className="card-value">{stats.totalDistance}</Text>
              <Text className="card-label">累计里程(km)</Text>
            </View>
            <View className="stat-card">
              <Text className="card-value">{stats.totalElevation}</Text>
              <Text className="card-label">累计爬升(m)</Text>
            </View>
            <View className="stat-card">
              <Text className="card-value">{stats.badgeCount}</Text>
              <Text className="card-label">获得勋章</Text>
            </View>
          </View>
        </View>
      )}

      {/* 帖子列表 */}
      <View className="posts-section">
        <View className="section-title">
          <Text className="title-text">TA的动态</Text>
        </View>
        <ScrollView
          className="posts-scroll"
          scrollY
          enableFlex
          onScrollToLower={handleScrollToLower}
        >
          {posts.length === 0 && !postLoading ? (
            <View className="empty-state">
              <Text className="empty-text">暂无动态</Text>
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

          {postLoading && (
            <View className="loading-state">
              <Text className="loading-text">加载中...</Text>
            </View>
          )}

          {!hasMore && posts.length > 0 && (
            <View className="no-more">
              <Text className="no-more-text">— 没有更多了 —</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
