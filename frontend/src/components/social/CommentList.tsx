import { View, Text, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import './CommentList.scss';

export interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  parent?: {
    user: {
      id: string;
      nickname: string;
    };
  } | null;
  replies?: CommentData[];
  _count?: {
    replies: number;
    likes: number;
  };
}

interface CommentListProps {
  comments: CommentData[];
  onLoadMore?: () => void;
  onReply?: (comment: CommentData) => void;
  onLike?: (commentId: string) => void;
  hasMore?: boolean;
  loading?: boolean;
}

export default function CommentList({
  comments,
  onLoadMore,
  onReply,
  onLike,
  hasMore = false,
  loading = false,
}: CommentListProps) {
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

  // 渲染单条评论
  const renderComment = (comment: CommentData, isReply = false) => (
    <View key={comment.id} className={`comment-item ${isReply ? 'reply' : ''}`}>
      <Image
        className="comment-avatar"
        src={comment.user.avatarUrl || 'https://img.icons8.com/ios-filled/100/user-male-circle.png'}
        mode="aspectFill"
      />
      <View className="comment-body">
        <View className="comment-header">
          <Text className="comment-nickname">{comment.user.nickname || '匿名用户'}</Text>
          {comment.parent && (
            <>
              <Text className="reply-arrow">回复</Text>
              <Text className="reply-target">{comment.parent.user.nickname}</Text>
            </>
          )}
        </View>
        <Text className="comment-content">{comment.content}</Text>
        <View className="comment-footer">
          <Text className="comment-time">{formatTime(comment.createdAt)}</Text>
          <View className="comment-actions">
            <Text className="action-btn" onClick={() => onReply?.(comment)}>
              回复
            </Text>
            <Text className="action-btn" onClick={() => onLike?.(comment.id)}>
              👍 {comment._count?.likes || ''}
            </Text>
          </View>
        </View>

        {/* 渲染回复 */}
        {comment.replies && comment.replies.length > 0 && (
          <View className="replies-container">
            {comment.replies.map((reply) => renderComment(reply, true))}
            {comment._count && comment._count.replies > comment.replies.length && (
              <Text className="view-more-replies">
                查看更多{comment._count.replies - comment.replies.length}条回复
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );

  if (comments.length === 0 && !loading) {
    return (
      <View className="comment-list empty">
        <Text className="empty-text">暂无评论，快来抢沙发吧~</Text>
      </View>
    );
  }

  return (
    <View className="comment-list">
      <View className="comment-header-bar">
        <Text className="comment-title">评论 ({comments.length})</Text>
      </View>

      {comments.map((comment) => renderComment(comment))}

      {hasMore && (
        <View className="load-more" onClick={onLoadMore}>
          <Text className="load-more-text">{loading ? '加载中...' : '加载更多'}</Text>
        </View>
      )}
    </View>
  );
}

// 评论输入框组件
interface CommentInputProps {
  placeholder?: string;
  onSubmit: (content: string) => void;
  loading?: boolean;
}

export function CommentInput({
  placeholder = '写评论...',
  onSubmit,
  loading = false,
}: CommentInputProps) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }
    onSubmit(content.trim());
    setContent('');
  };

  return (
    <View className="comment-input-bar">
      <Input
        className="comment-input"
        placeholder={placeholder}
        value={content}
        onInput={(e) => setContent(e.detail.value)}
        confirmType="send"
        onConfirm={handleSubmit}
        disabled={loading}
      />
      <View
        className={`submit-btn ${content.trim() ? 'active' : ''}`}
        onClick={handleSubmit}
      >
        <Text className="submit-text">{loading ? '发送中' : '发送'}</Text>
      </View>
    </View>
  );
}
