import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import api from '../../services/request';
import './BadgeWall.scss';

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  earned: boolean;
  earnedAt: string | null;
}

interface BadgeWallProps {
  userId?: string; // 如果不传，展示当前用户的勋章墙
}

// 勋章分类映射
const categoryNames: Record<string, string> = {
  MILESTONE: '里程碑',
  CUMULATIVE: '累计型',
  CHALLENGE: '挑战型',
  SPECIAL: '特殊型',
  SOCIAL: '社交型',
  CONTRIBUTION: '贡献型',
  LEADER: '领队专属',
};

export default function BadgeWall({ userId }: BadgeWallProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    setLoading(true);
    try {
      let result: Badge[];
      if (userId) {
        // 查看他人勋章
        result = await api.getUserBadges(userId);
      } else {
        // 查看自己的勋章墙（包含未获得的）
        result = await api.getBadgeWall();
      }
      setBadges(result);
    } catch (error) {
      console.error('Failed to load badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBadgeClick = (badge: Badge) => {
    setSelectedBadge(badge);
  };

  const closeBadgeDetail = () => {
    setSelectedBadge(null);
  };

  // 按分类分组勋章
  const groupedBadges = badges.reduce((acc, badge) => {
    const category = badge.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  const earnedCount = badges.filter((b) => b.earned).length;

  if (loading) {
    return (
      <View className="badge-wall loading">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="badge-wall">
      {/* 统计信息 */}
      <View className="stats-bar">
        <Text className="stats-text">
          已获得 {earnedCount}/{badges.length} 枚勋章
        </Text>
      </View>

      {/* 勋章分类展示 */}
      {Object.entries(groupedBadges).map(([category, categoryBadges]) => (
        <View key={category} className="badge-category">
          <View className="category-header">
            <Text className="category-name">{categoryNames[category] || category}</Text>
            <Text className="category-count">
              {categoryBadges.filter((b) => b.earned).length}/{categoryBadges.length}
            </Text>
          </View>
          <View className="badge-grid">
            {categoryBadges.map((badge) => (
              <View
                key={badge.id}
                className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}
                onClick={() => handleBadgeClick(badge)}
              >
                <Text className="badge-icon">{badge.icon}</Text>
                <Text className="badge-name">{badge.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* 勋章详情弹窗 */}
      {selectedBadge && (
        <View className="badge-modal" onClick={closeBadgeDetail}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <View className={`badge-detail ${selectedBadge.earned ? 'earned' : 'locked'}`}>
              <Text className="detail-icon">{selectedBadge.icon}</Text>
              <Text className="detail-name">{selectedBadge.name}</Text>
              <Text className="detail-description">{selectedBadge.description}</Text>
              {selectedBadge.earned && selectedBadge.earnedAt && (
                <Text className="detail-earned-at">
                  获得时间: {new Date(selectedBadge.earnedAt).toLocaleDateString()}
                </Text>
              )}
              {!selectedBadge.earned && (
                <Text className="detail-locked-hint">继续努力，即可获得此勋章!</Text>
              )}
            </View>
            <View className="close-btn" onClick={closeBadgeDetail}>
              <Text className="close-text">关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export { BadgeWall };
