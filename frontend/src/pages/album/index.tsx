import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import api from '../../services/request';
import './index.scss';

interface PhotoData {
  id: string;
  url: string;
  description: string | null;
  isFeatured: boolean;
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

interface AlbumStats {
  totalCount: number;
  featuredCount: number;
  contributorCount: number;
}

export default function AlbumIndex() {
  const router = useRouter();
  const activityId = router.params.activityId || '';

  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [stats, setStats] = useState<AlbumStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showFeatured, setShowFeatured] = useState(false);

  // 加载照片
  const loadPhotos = useCallback(
    async (refresh = false) => {
      if (!activityId) return;
      if (loading && !refresh) return;
      if (!refresh && !hasMore) return;

      setLoading(true);
      try {
        const result = await api.getActivityPhotos(activityId, {
          cursor: refresh ? undefined : cursor || undefined,
          featuredOnly: showFeatured,
        });

        const newPhotos = result.photos || [];

        if (refresh) {
          setPhotos(newPhotos);
        } else {
          setPhotos((prev) => [...prev, ...newPhotos]);
        }

        setCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);
      } catch (error) {
        console.error('Failed to load photos:', error);
      } finally {
        setLoading(false);
      }
    },
    [activityId, cursor, hasMore, loading, showFeatured]
  );

  // 加载统计
  const loadStats = useCallback(async () => {
    if (!activityId) return;
    try {
      const result = await api.getAlbumStats(activityId);
      setStats(result);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [activityId]);

  // 页面显示时加载
  useDidShow(() => {
    loadStats();
    loadPhotos(true);
  });

  // 切换筛选
  const toggleFeatured = () => {
    setShowFeatured(!showFeatured);
    setPhotos([]);
    setCursor(null);
    setHasMore(true);
    setTimeout(() => loadPhotos(true), 100);
  };

  // 预览图片
  const previewPhoto = (index: number) => {
    Taro.previewImage({
      current: photos[index].url,
      urls: photos.map((p) => p.url),
    });
  };

  // 上传照片
  const handleUpload = async () => {
    try {
      const result = await Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      // TODO: 上传到 OSS 并调用 API
      Taro.showToast({ title: '上传功能开发中', icon: 'none' });
    } catch (error) {
      console.error('Choose image failed:', error);
    }
  };

  // 滚动加载更多
  const handleScrollToLower = () => {
    if (hasMore && !loading) {
      loadPhotos();
    }
  };

  return (
    <View className="album-page">
      {/* 统计栏 */}
      {stats && (
        <View className="stats-bar">
          <View className="stat-item">
            <Text className="stat-value">{stats.totalCount}</Text>
            <Text className="stat-label">张照片</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{stats.featuredCount}</Text>
            <Text className="stat-label">精选</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{stats.contributorCount}</Text>
            <Text className="stat-label">贡献者</Text>
          </View>
        </View>
      )}

      {/* 筛选栏 */}
      <View className="filter-bar">
        <View
          className={`filter-item ${!showFeatured ? 'active' : ''}`}
          onClick={() => showFeatured && toggleFeatured()}
        >
          <Text className="filter-text">全部</Text>
        </View>
        <View
          className={`filter-item ${showFeatured ? 'active' : ''}`}
          onClick={() => !showFeatured && toggleFeatured()}
        >
          <Text className="filter-text">精选</Text>
        </View>
      </View>

      {/* 照片网格 */}
      <ScrollView
        className="photo-grid-scroll"
        scrollY
        enableFlex
        onScrollToLower={handleScrollToLower}
      >
        {photos.length === 0 && !loading ? (
          <View className="empty-state">
            <Text className="empty-icon">📷</Text>
            <Text className="empty-text">暂无照片，快来上传第一张吧</Text>
          </View>
        ) : (
          <View className="photo-grid">
            {photos.map((photo, index) => (
              <View
                key={photo.id}
                className="photo-item"
                onClick={() => previewPhoto(index)}
              >
                <Image
                  className="photo-image"
                  src={photo.url}
                  mode="aspectFill"
                />
                {photo.isFeatured && (
                  <View className="featured-badge">
                    <Text className="featured-text">精选</Text>
                  </View>
                )}
                <View className="photo-overlay">
                  <Text className="photo-author">{photo.user.nickname}</Text>
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
        {!hasMore && photos.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">— 没有更多了 —</Text>
          </View>
        )}
      </ScrollView>

      {/* 上传按钮 */}
      <View className="upload-btn" onClick={handleUpload}>
        <Text className="upload-icon">📷</Text>
        <Text className="upload-text">上传照片</Text>
      </View>
    </View>
  );
}
