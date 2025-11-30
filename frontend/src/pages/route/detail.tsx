import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Loading, Tag, Button } from '@nutui/nutui-react-taro'
import '@nutui/nutui-react-taro/dist/style.css'
import { api } from '../../services/request'
import RouteMap from '../../components/map/RouteMap'
import ElevationChart from '../../components/chart/ElevationChart'
import './detail.scss'

interface GeoJsonLineString {
  type: 'LineString'
  coordinates: number[][]
}

interface RouteDetail {
  id: string
  name: string
  difficulty: number
  distance: number
  elevation: number
  gpxUrl: string | null
  description: string | null
  coverUrl: string | null
  region: string | null
  estimatedTime: number | null
  createdAt: string
  geojson: GeoJsonLineString | null
  startPoint: { lat: number; lon: number } | null
  endPoint: { lat: number; lon: number } | null
}

interface RelatedActivity {
  id: string
  title: string
  startTime: string
  price: string
  status: string
  _count?: {
    enrollments: number
  }
  maxPeople: number
}

export default function RouteDetailPage() {
  const router = useRouter()
  const { id } = router.params

  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [activities, setActivities] = useState<RelatedActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadRouteDetail()
    }
  }, [id])

  const loadRouteDetail = async () => {
    try {
      setLoading(true)
      const data = await api.getRouteDetail(id!, true)
      setRoute(data)
      // 如果有关联活动数据
      if (data.activities) {
        setActivities(data.activities)
      }
    } catch (error) {
      console.error('Failed to load route:', error)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyText = (level: number) => {
    const texts = ['', '入门', '初级', '中级', '进阶', '专业']
    return texts[level] || '未知'
  }

  const getDifficultyColor = (level: number) => {
    const colors = ['', '#52c41a', '#1890ff', '#faad14', '#f5222d', '#722ed1']
    return colors[level] || '#999'
  }

  const formatTime = (minutes: number | null) => {
    if (!minutes) return '未知'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
    }
    return `${mins}分钟`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  const handleActivityClick = (activityId: string) => {
    Taro.navigateTo({
      url: `/pages/activity/detail?id=${activityId}`,
    })
  }

  if (loading) {
    return (
      <View className='route-detail-page loading'>
        <Loading type='spinner'>加载中...</Loading>
      </View>
    )
  }

  if (!route) {
    return (
      <View className='route-detail-page error'>
        <Text>线路不存在</Text>
      </View>
    )
  }

  return (
    <ScrollView className='route-detail-page' scrollY>
      {/* 顶部封面图 */}
      <View className='cover-section'>
        {route.coverUrl ? (
          <Image src={route.coverUrl} mode='aspectFill' className='cover-image' />
        ) : (
          <View className='cover-placeholder'>
            <Text className='cover-text'>{route.name.substring(0, 2)}</Text>
          </View>
        )}
        <View className='cover-overlay'>
          <Text className='route-name'>{route.name}</Text>
          {route.region && <Text className='route-region'>{route.region}</Text>}
        </View>
      </View>

      {/* 线路统计信息 */}
      <View className='stats-section'>
        <View className='stat-item'>
          <Text className='stat-value'>{route.distance}</Text>
          <Text className='stat-label'>公里</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-value'>{route.elevation}</Text>
          <Text className='stat-label'>爬升(米)</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-value'>{formatTime(route.estimatedTime)}</Text>
          <Text className='stat-label'>预计用时</Text>
        </View>
        <View className='stat-item'>
          <Tag color={getDifficultyColor(route.difficulty)}>
            {getDifficultyText(route.difficulty)}
          </Tag>
          <Text className='stat-label'>难度</Text>
        </View>
      </View>

      {/* 地图轨迹 */}
      <View className='map-section'>
        <Text className='section-title'>线路轨迹</Text>
        <RouteMap
          geojson={route.geojson}
          startPoint={route.startPoint}
          endPoint={route.endPoint}
          height={250}
        />
        {route.startPoint && (
          <View className='map-info'>
            <Text className='info-item'>
              起点: {route.startPoint.lat.toFixed(4)}, {route.startPoint.lon.toFixed(4)}
            </Text>
            {route.endPoint && route.endPoint.lat !== route.startPoint.lat && (
              <Text className='info-item'>
                终点: {route.endPoint.lat.toFixed(4)}, {route.endPoint.lon.toFixed(4)}
              </Text>
            )}
            {route.endPoint && route.endPoint.lat === route.startPoint.lat && (
              <Text className='info-item loop'>环线</Text>
            )}
          </View>
        )}
      </View>

      {/* 海拔剖面图 */}
      <View className='elevation-section'>
        <Text className='section-title'>海拔剖面</Text>
        <ElevationChart routeId={route.id} height={180} />
      </View>

      {/* 线路描述 */}
      {route.description && (
        <View className='desc-section'>
          <Text className='section-title'>线路介绍</Text>
          <Text className='description'>{route.description}</Text>
        </View>
      )}

      {/* 相关活动 */}
      {activities.length > 0 && (
        <View className='activities-section'>
          <Text className='section-title'>近期活动</Text>
          <View className='activity-list'>
            {activities.map((activity) => (
              <View
                key={activity.id}
                className='activity-card'
                onClick={() => handleActivityClick(activity.id)}
              >
                <View className='activity-info'>
                  <Text className='activity-title'>{activity.title}</Text>
                  <View className='activity-meta'>
                    <Text className='activity-date'>{formatDate(activity.startTime)}</Text>
                    <Text className='activity-slots'>
                      {activity._count?.enrollments || 0}/{activity.maxPeople}人
                    </Text>
                  </View>
                </View>
                <View className='activity-price'>
                  <Text className='price'>¥{activity.price}</Text>
                  <Button size='small' type='primary'>
                    查看
                  </Button>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 底部安全间距 */}
      <View className='safe-bottom' />
    </ScrollView>
  )
}
