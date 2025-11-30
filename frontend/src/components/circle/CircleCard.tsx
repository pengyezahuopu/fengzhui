import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './CircleCard.scss';

export interface CircleData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  memberCount: number;
  postCount: number;
}

interface CircleCardProps {
  circle: CircleData;
}

export default function CircleCard({ circle }: CircleCardProps) {
  const goToDetail = () => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${circle.id}` });
  };

  return (
    <View className="circle-card" onClick={goToDetail}>
      <Image
        className="circle-icon"
        src={circle.icon || 'https://img.icons8.com/ios-filled/100/group.png'}
        mode="aspectFill"
      />
      <View className="circle-info">
        <Text className="circle-name">{circle.name}</Text>
        <Text className="circle-desc">{circle.description || '暂无介绍'}</Text>
        <View className="circle-stats">
          <Text className="stat-item">{circle.memberCount}成员</Text>
          <Text className="stat-item">{circle.postCount}动态</Text>
        </View>
      </View>
    </View>
  );
}
