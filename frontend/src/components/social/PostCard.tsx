import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import './PostCard.scss';

export interface PostData {
  id: string;
  content: string;
  images: { url: string }[];
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  activity?: {
    id: string;
    title: string;
  } | null;
  route?: {
    id: string;
    name: string;
  } | null;
  circle?: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
  tags: string[];
  createdAt: string;
  _count: {
    likes: number;
    comments: number;
  };
  isLiked?: boolean;
}

interface PostCardProps {
  post: PostData;
  onLike?: (postId: string, liked: boolean) => void;
  onComment?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  showFullContent?: boolean;
}

export default function PostCard({
  post,
  onLike,
  onComment,
  onUserClick,
  showFullContent = false,
}: PostCardProps) {
  const [liked, setLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post._count.likes);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 处理点赞
  const handleLike = (e: any) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => (newLiked ? prev + 1 : prev - 1));
    onLike?.(post.id, newLiked);
  };

  // 处理评论
  const handleComment = (e: any) => {
    e.stopPropagation();
    onComment?.(post.id);
  };

  // 处理用户点击
  const handleUserClick = (e: any) => {
    e.stopPropagation();
    onUserClick?.(post.user.id);
  };

  // 跳转到帖子详情
  const goToDetail = () => {
    Taro.navigateTo({ url: `/pages/post/detail?id=${post.id}` });
  };

  // 预览图片
  const previewImage = (index: number, e: any) => {
    e.stopPropagation();
    Taro.previewImage({
      current: post.images[index].url,
      urls: post.images.map((img) => img.url),
    });
  };

  // 截断内容
  const displayContent = showFullContent
    ? post.content
    : post.content.length > 140
    ? post.content.substring(0, 140) + '...'
    : post.content;

  return (
    <View className="post-card" onClick={goToDetail}>
      {/* 用户信息 */}
      <View className="post-header" onClick={handleUserClick}>
        <Image
          className="avatar"
          src={post.user.avatarUrl || 'https://img.icons8.com/ios-filled/100/user-male-circle.png'}
          mode="aspectFill"
        />
        <View className="user-info">
          <Text className="nickname">{post.user.nickname || '匿名用户'}</Text>
          <Text className="time">{formatTime(post.createdAt)}</Text>
        </View>
      </View>

      {/* 内容 */}
      <View className="post-content">
        <Text className="content-text">{displayContent}</Text>
        {!showFullContent && post.content.length > 140 && (
          <Text className="read-more">展开</Text>
        )}
      </View>

      {/* 图片 */}
      {post.images.length > 0 && (
        <View className={`post-images images-${Math.min(post.images.length, 9)}`}>
          {post.images.slice(0, 9).map((img, index) => (
            <Image
              key={index}
              className="post-image"
              src={img.url}
              mode="aspectFill"
              onClick={(e) => previewImage(index, e)}
            />
          ))}
        </View>
      )}

      {/* 关联标签 */}
      <View className="post-tags">
        {post.activity && (
          <View className="tag tag-activity">
            <Text className="tag-icon">📍</Text>
            <Text className="tag-text">{post.activity.title}</Text>
          </View>
        )}
        {post.route && (
          <View className="tag tag-route">
            <Text className="tag-icon">🗺️</Text>
            <Text className="tag-text">{post.route.name}</Text>
          </View>
        )}
        {post.tags.slice(0, 3).map((tag, index) => (
          <View key={index} className="tag tag-topic">
            <Text className="tag-text">#{tag}</Text>
          </View>
        ))}
      </View>

      {/* 互动栏 */}
      <View className="post-actions">
        <View className={`action-item ${liked ? 'liked' : ''}`} onClick={handleLike}>
          <Text className="action-icon">{liked ? '❤️' : '🤍'}</Text>
          <Text className="action-count">{likeCount || ''}</Text>
        </View>
        <View className="action-item" onClick={handleComment}>
          <Text className="action-icon">💬</Text>
          <Text className="action-count">{post._count.comments || ''}</Text>
        </View>
        <View className="action-item">
          <Text className="action-icon">↗️</Text>
        </View>
      </View>
    </View>
  );
}
