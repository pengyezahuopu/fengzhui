import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { PostCard, PostData } from '../../components/social';
import { CommentList, CommentInput, CommentData } from '../../components/social';
import api from '../../services/request';
import './detail.scss';

export default function PostDetail() {
  const router = useRouter();
  const postId = router.params.id || '';

  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [replyTo, setReplyTo] = useState<CommentData | null>(null);

  // 加载帖子详情
  const loadPost = useCallback(async () => {
    if (!postId) return;

    try {
      const result = await api.getPostDetail(postId);
      setPost(result);
    } catch (error) {
      console.error('Failed to load post:', error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    }
  }, [postId]);

  // 加载评论列表
  const loadComments = useCallback(
    async (refresh = false) => {
      if (!postId) return;
      if (commentLoading) return;
      if (!refresh && !hasMore) return;

      setCommentLoading(true);
      try {
        const result = await api.getComments(postId, refresh ? undefined : cursor || undefined);
        const newComments = result.comments || [];

        if (refresh) {
          setComments(newComments);
        } else {
          setComments((prev) => [...prev, ...newComments]);
        }

        setCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setCommentLoading(false);
      }
    },
    [postId, cursor, hasMore, commentLoading]
  );

  // 页面显示时加载
  useDidShow(() => {
    setLoading(true);
    Promise.all([loadPost(), loadComments(true)]).finally(() => {
      setLoading(false);
    });
  });

  // 处理点赞
  const handleLike = async (id: string, liked: boolean) => {
    try {
      if (liked) {
        await api.likePost(id);
      } else {
        await api.unlikePost(id);
      }
      // 更新本地状态
      if (post && post.id === id) {
        setPost({
          ...post,
          isLiked: liked,
          _count: {
            ...post._count,
            likes: post._count.likes + (liked ? 1 : -1),
          },
        });
      }
    } catch (error) {
      console.error('Like failed:', error);
    }
  };

  // 处理评论点赞
  const handleCommentLike = async (commentId: string) => {
    try {
      await api.likeComment(commentId);
      // 更新本地评论状态
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              _count: {
                ...c._count,
                likes: (c._count?.likes || 0) + 1,
              },
            };
          }
          return c;
        })
      );
    } catch (error) {
      console.error('Comment like failed:', error);
    }
  };

  // 处理回复
  const handleReply = (comment: CommentData) => {
    setReplyTo(comment);
  };

  // 取消回复
  const cancelReply = () => {
    setReplyTo(null);
  };

  // 提交评论
  const handleSubmitComment = async (content: string) => {
    if (!postId || submitting) return;

    setSubmitting(true);
    try {
      const newComment = await api.createComment({
        postId,
        content,
        parentId: replyTo?.id,
      });

      // 添加到评论列表顶部
      setComments((prev) => [newComment, ...prev]);

      // 更新帖子评论数
      if (post) {
        setPost({
          ...post,
          _count: {
            ...post._count,
            comments: post._count.comments + 1,
          },
        });
      }

      setReplyTo(null);
      Taro.showToast({ title: '评论成功', icon: 'success' });
    } catch (error) {
      console.error('Submit comment failed:', error);
      Taro.showToast({ title: '评论失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  // 跳转到用户主页
  const handleUserClick = (userId: string) => {
    Taro.navigateTo({ url: `/pages/user/profile?id=${userId}` });
  };

  if (loading && !post) {
    return (
      <View className="post-detail-page loading">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View className="post-detail-page error">
        <Text className="error-text">帖子不存在或已删除</Text>
      </View>
    );
  }

  return (
    <View className="post-detail-page">
      <ScrollView className="detail-scroll" scrollY enableFlex>
        {/* 帖子内容 */}
        <PostCard
          post={post}
          onLike={handleLike}
          onComment={() => {}}
          onUserClick={handleUserClick}
          showFullContent
        />

        {/* 评论区域 */}
        <View className="comments-section">
          <CommentList
            comments={comments}
            onLoadMore={() => loadComments()}
            onReply={handleReply}
            onLike={handleCommentLike}
            hasMore={hasMore}
            loading={commentLoading}
          />
        </View>
      </ScrollView>

      {/* 评论输入框 */}
      <View className="comment-input-wrapper">
        {replyTo && (
          <View className="reply-hint">
            <Text className="reply-text">回复 @{replyTo.user.nickname}</Text>
            <Text className="cancel-reply" onClick={cancelReply}>
              取消
            </Text>
          </View>
        )}
        <CommentInput
          placeholder={replyTo ? `回复 @${replyTo.user.nickname}` : '写评论...'}
          onSubmit={handleSubmitComment}
          loading={submitting}
        />
      </View>
    </View>
  );
}
