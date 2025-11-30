import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { PostCard, PostData } from '../../components/social';
import api from '../../services/request';
import './detail.scss';

interface CircleDetail {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  coverUrl: string | null;
  category: string;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  myRole: string | null;
  creator: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  club?: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      nickname: string;
      avatarUrl: string | null;
    };
  }>;
}

export default function CircleDetailPage() {
  const router = useRouter();
  const circleId = router.params.id || '';

  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'members'>('posts');

  // 加载圈子详情
  const loadCircle = useCallback(async () => {
    if (!circleId) return;
    try {
      const result = await api.getCircleDetail(circleId);
      setCircle(result);
    } catch (error) {
      console.error('Failed to load circle:', error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    }
  }, [circleId]);

  // 加载圈子帖子
  const loadPosts = useCallback(
    async (refresh = false) => {
      if (!circleId) return;
      if (postLoading) return;
      if (!refresh && !hasMore) return;

      setPostLoading(true);
      try {
        const result = await api.getCirclePosts(
          circleId,
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
    [circleId, cursor, hasMore, postLoading]
  );

  // 页面显示时加载
  useDidShow(() => {
    setLoading(true);
    Promise.all([loadCircle(), loadPosts(true)]).finally(() => {
      setLoading(false);
    });
  });

  // 加入/退出圈子
  const handleJoinToggle = async () => {
    if (!circle || joining) return;

    setJoining(true);
    try {
      if (circle.isJoined) {
        await api.leaveCircle(circleId);
        Taro.showToast({ title: '已退出圈子', icon: 'success' });
      } else {
        await api.joinCircle(circleId);
        Taro.showToast({ title: '加入成功', icon: 'success' });
      }
      // 刷新圈子信息
      loadCircle();
    } catch (error: any) {
      Taro.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      setJoining(false);
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

  // 跳转到评论
  const handleComment = (postId: string) => {
    Taro.navigateTo({ url: `/pages/post/detail?id=${postId}` });
  };

  // 跳转到用户主页
  const handleUserClick = (userId: string) => {
    Taro.navigateTo({ url: `/pages/user/profile?id=${userId}` });
  };

  // 发布帖子到圈子
  const goToPublish = () => {
    Taro.navigateTo({ url: `/pages/post/publish?circleId=${circleId}` });
  };

  // 滚动加载更多
  const handleScrollToLower = () => {
    if (activeTab === 'posts' && hasMore && !postLoading) {
      loadPosts();
    }
  };

  if (loading && !circle) {
    return (
      <View className="circle-detail loading">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  if (!circle) {
    return (
      <View className="circle-detail error">
        <Text className="error-text">圈子不存在</Text>
      </View>
    );
  }

  return (
    <View className="circle-detail">
      {/* 圈子头部信息 */}
      <View className="circle-header">
        <Image
          className="circle-cover"
          src={circle.coverUrl || 'https://img.icons8.com/color/400/groups.png'}
          mode="aspectFill"
        />
        <View className="header-overlay">
          <View className="circle-info">
            <Image
              className="circle-icon"
              src={circle.icon || 'https://img.icons8.com/color/100/groups.png'}
              mode="aspectFill"
            />
            <View className="circle-meta">
              <Text className="circle-name">{circle.name}</Text>
              <Text className="circle-stats">
                {circle.memberCount} 成员 · {circle.postCount} 帖子
              </Text>
            </View>
          </View>
          {circle.description && (
            <Text className="circle-desc">{circle.description}</Text>
          )}
          <View
            className={`join-btn ${circle.isJoined ? 'joined' : ''}`}
            onClick={handleJoinToggle}
          >
            <Text className="join-text">
              {joining ? '处理中...' : circle.isJoined ? '已加入' : '加入圈子'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tab 切换 */}
      <View className="tab-bar">
        <View
          className={`tab-item ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <Text className="tab-text">帖子</Text>
        </View>
        <View
          className={`tab-item ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Text className="tab-text">成员</Text>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView
        className="content-area"
        scrollY
        enableFlex
        onScrollToLower={handleScrollToLower}
      >
        {activeTab === 'posts' ? (
          posts.length === 0 && !postLoading ? (
            <View className="empty-state">
              <Text className="empty-icon">📝</Text>
              <Text className="empty-text">暂无帖子，快来发布第一条吧</Text>
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
          )
        ) : (
          <View className="member-list">
            {circle.members.map((member) => (
              <View
                key={member.id}
                className="member-item"
                onClick={() => handleUserClick(member.user.id)}
              >
                <Image
                  className="member-avatar"
                  src={member.user.avatarUrl || 'https://img.icons8.com/ios-filled/100/user-male-circle.png'}
                  mode="aspectFill"
                />
                <View className="member-info">
                  <Text className="member-name">{member.user.nickname}</Text>
                  {member.role !== 'MEMBER' && (
                    <Text className="member-role">
                      {member.role === 'OWNER' ? '圈主' : '管理员'}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 加载状态 */}
        {postLoading && (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {/* 没有更多 */}
        {activeTab === 'posts' && !hasMore && posts.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">— 没有更多了 —</Text>
          </View>
        )}
      </ScrollView>

      {/* 发布按钮（已加入时显示） */}
      {circle.isJoined && (
        <View className="publish-btn" onClick={goToPublish}>
          <Text className="publish-icon">+</Text>
        </View>
      )}
    </View>
  );
}
