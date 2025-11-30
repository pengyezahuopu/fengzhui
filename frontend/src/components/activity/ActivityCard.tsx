import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Tag } from '@nutui/nutui-react-taro';
import './ActivityCard.scss';

export interface ActivityCardData {
  id: string;
  title: string;
  coverUrl: string | null;
  startTime: string;
  endTime: string;
  price: string;
  maxPeople: number;
  status: string;
  route: {
    name: string;
    difficulty: number;
    distance: number;
  } | null;
  club: {
    name: string;
  } | null;
  _count: {
    enrollments: number;
  };
}

interface ActivityCardProps {
  activity: ActivityCardData;
  onClick?: (id: string) => void;
  showButton?: boolean;
}

const DIFFICULTY_TEXTS = ['', '入门', '初级', '中级', '进阶', '专业'];
const DIFFICULTY_COLORS = ['', '#52c41a', '#1890ff', '#faad14', '#f5222d', '#722ed1'];

/**
 * 格式化日期显示
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 获取难度文字
 */
function getDifficultyText(level: number): string {
  return DIFFICULTY_TEXTS[level] || '未知';
}

/**
 * 获取难度颜色
 */
function getDifficultyColor(level: number): string {
  return DIFFICULTY_COLORS[level] || '#999';
}

/**
 * 获取活动状态信息
 */
function getStatusInfo(activity: ActivityCardData): { text: string; class: string } {
  const enrollCount = activity._count?.enrollments || 0;
  const isFull = enrollCount >= activity.maxPeople;

  if (activity.status !== 'PUBLISHED') {
    return { text: '已结束', class: 'ended' };
  }
  if (isFull) {
    return { text: '已满员', class: 'full' };
  }
  return { text: '报名中', class: 'recruiting' };
}

/**
 * 活动卡片组件
 * 用于活动列表、首页推荐等场景
 */
export default function ActivityCard({
  activity,
  onClick,
  showButton = true,
}: ActivityCardProps) {
  const statusInfo = getStatusInfo(activity);

  const handleClick = () => {
    if (onClick) {
      onClick(activity.id);
    } else {
      Taro.navigateTo({ url: `/pages/activity/detail?id=${activity.id}` });
    }
  };

  return (
    <View className="activity-card" onClick={handleClick}>
      <View className="activity-card__image">
        {activity.coverUrl ? (
          <Image src={activity.coverUrl} mode="aspectFill" />
        ) : (
          <View className="activity-card__placeholder">
            <Text className="activity-card__placeholder-text">
              {activity.route?.name?.substring(0, 2) || '活动'}
            </Text>
          </View>
        )}
        <Text className={`activity-card__status-badge activity-card__status-badge--${statusInfo.class}`}>
          {statusInfo.text}
        </Text>
        <Text className="activity-card__date-badge">{formatDate(activity.startTime)}</Text>
      </View>

      <View className="activity-card__content">
        <Text className="activity-card__title">{activity.title}</Text>

        <View className="activity-card__tags">
          <Tag color={getDifficultyColor(activity.route?.difficulty || 1)}>
            {getDifficultyText(activity.route?.difficulty || 1)}
          </Tag>
          <Tag plain>{activity.route?.distance || 0}km</Tag>
        </View>

        <View className="activity-card__meta">
          <Text className="activity-card__club-name">{activity.club?.name || '未知俱乐部'}</Text>
          <Text className="activity-card__enrollment">
            {activity._count?.enrollments || 0}/{activity.maxPeople}人已报名
          </Text>
        </View>

        <View className="activity-card__footer">
          <Text className="activity-card__price">
            ¥{activity.price}
            <Text className="activity-card__price-unit">/人</Text>
          </Text>
          {showButton && (
            <Button type="primary" size="small">
              查看详情
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
