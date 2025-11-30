import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import api from '../../services/request';
import './index.scss';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  value: number;
}

interface MyRankings {
  routeContribution: { rank: number; value: number } | null;
  activityCount: { rank: number; value: number } | null;
  totalDistance: { rank: number; value: number } | null;
  totalElevation: { rank: number; value: number } | null;
  badgeCount: { rank: number; value: number } | null;
}

type TabType = 'active' | 'distance' | 'elevation' | 'contributors' | 'badges';

const TABS: { key: TabType; label: string; unit: string }[] = [
  { key: 'active', label: '活跃度', unit: '次' },
  { key: 'distance', label: '里程', unit: 'km' },
  { key: 'elevation', label: '爬升', unit: 'm' },
  { key: 'contributors', label: '贡献', unit: '条' },
  { key: 'badges', label: '勋章', unit: '枚' },
];

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRankings, setMyRankings] = useState<MyRankings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async (tab: TabType) => {
    setLoading(true);
    try {
      let result: LeaderboardEntry[];
      switch (tab) {
        case 'active':
          result = await api.getActiveUsers(50);
          break;
        case 'distance':
          result = await api.getDistanceLeaders(50);
          break;
        case 'elevation':
          result = await api.getElevationLeaders(50);
          break;
        case 'contributors':
          result = await api.getRouteContributors(50);
          break;
        case 'badges':
          result = await api.getBadgeLeaders(50);
          break;
        default:
          result = [];
      }
      setLeaderboard(result);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyRankings = useCallback(async () => {
    try {
      const result = await api.getMyRankings();
      setMyRankings(result);
    } catch (error) {
      console.error('Failed to load my rankings:', error);
    }
  }, []);

  useDidShow(() => {
    loadLeaderboard(activeTab);
    loadMyRankings();
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    loadLeaderboard(tab);
  };

  const handleUserClick = (userId: string) => {
    Taro.navigateTo({ url: `/pages/user/profile?id=${userId}` });
  };

  const getCurrentTabUnit = () => {
    return TABS.find((t) => t.key === activeTab)?.unit || '';
  };

  const getMyRank = () => {
    if (!myRankings) return null;
    switch (activeTab) {
      case 'active':
        return myRankings.activityCount;
      case 'distance':
        return myRankings.totalDistance;
      case 'elevation':
        return myRankings.totalElevation;
      case 'contributors':
        return myRankings.routeContribution;
      case 'badges':
        return myRankings.badgeCount;
      default:
        return null;
    }
  };

  const myRank = getMyRank();

  return (
    <View className="leaderboard-page">
      {/* Tab 切换 */}
      <View className="tabs">
        <ScrollView scrollX className="tabs-scroll" showScrollbar={false}>
          {TABS.map((tab) => (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <Text className="tab-text">{tab.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 我的排名 */}
      {myRank && (
        <View className="my-ranking">
          <View className="ranking-content">
            <Text className="ranking-label">我的排名</Text>
            <View className="ranking-info">
              <Text className="ranking-position">第 {myRank.rank} 名</Text>
              <Text className="ranking-value">
                {myRank.value} {getCurrentTabUnit()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 排行榜列表 */}
      <ScrollView scrollY className="leaderboard-list" enableFlex>
        {loading ? (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : leaderboard.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-text">暂无排行数据</Text>
          </View>
        ) : (
          leaderboard.map((entry, index) => (
            <View
              key={entry.userId}
              className={`rank-item ${index < 3 ? 'top-' + (index + 1) : ''}`}
              onClick={() => handleUserClick(entry.userId)}
            >
              <View className="rank-position">
                {index < 3 ? (
                  <Text className="rank-medal">{['🥇', '🥈', '🥉'][index]}</Text>
                ) : (
                  <Text className="rank-number">{entry.rank}</Text>
                )}
              </View>
              <Image
                className="user-avatar"
                src={entry.avatarUrl || 'https://img.icons8.com/ios-filled/100/user-male-circle.png'}
                mode="aspectFill"
              />
              <View className="user-info">
                <Text className="user-name">{entry.nickname}</Text>
              </View>
              <View className="rank-value">
                <Text className="value-number">{entry.value}</Text>
                <Text className="value-unit">{getCurrentTabUnit()}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
