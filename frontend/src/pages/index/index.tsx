import { View, Text, Image } from '@tarojs/components'
import { useLoad, usePullDownRefresh } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Button, Swiper, SwiperItem, Empty, Loading } from '@nutui/nutui-react-taro'
import '@nutui/nutui-react-taro/dist/style.css'
import { api } from '../../services/request'
import './index.scss'

interface Activity {
  id: string
  title: string
  coverUrl: string | null
  startTime: string
  price: string
  maxPeople: number
  status: string
  route: {
    name: string
    difficulty: number
    distance: number
    elevation: number
  }
  club: {
    id: string
    name: string
    logo: string | null
  }
  _count: {
    enrollments: number
  }
}

export default function Index() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    console.log('Page loaded.')
    loadActivities()
  })

  usePullDownRefresh(() => {
    loadActivities().then(() => {
      Taro.stopPullDownRefresh()
    })
  })

  const loadActivities = async () => {
    try {
      setLoading(true)
      const data = await api.getRecommendedActivities(10)
      setActivities(data || [])
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleActivityClick = (activityId: string) => {
    Taro.navigateTo({
      url: `/pages/activity/detail?id=${activityId}`
    })
  }

  const handleEnrollClick = (e: any, activityId: string) => {
    e.stopPropagation()
    Taro.navigateTo({
      url: `/pages/activity/detail?id=${activityId}`
    })
  }

  const handleViewMore = () => {
    Taro.switchTab({
      url: '/pages/activities/index'
    })
  }

  const handleQuickEntry = (type: string) => {
    Taro.showToast({
      title: `${type}活动开发中`,
      icon: 'none'
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  const getDifficultyText = (level: number) => {
    const texts = ['', '入门', '初级', '中级', '进阶', '专业']
    return texts[level] || '未知'
  }

  const bannerList = [
    'https://storage.360buyimg.com/jdc-article/NutUItaro34.jpg',
    'https://storage.360buyimg.com/jdc-article/NutUItaro2.jpg',
    'https://storage.360buyimg.com/jdc-article/welcomenutui.jpg',
    'https://storage.360buyimg.com/jdc-article/fristfabu.jpg'
  ]

  return (
    <View className='index'>
      <View className='banner-container'>
        <Swiper
          defaultValue={0}
          autoPlay
          indicator
          style={{ height: '150px' }}
        >
          {bannerList.map((item, index) => (
            <SwiperItem key={index}>
              <Image src={item} mode='aspectFill' style={{ width: '100%', height: '100%' }} />
            </SwiperItem>
          ))}
        </Swiper>
      </View>

      <View className='quick-entry'>
        <View className='entry-item' onClick={() => handleQuickEntry('徒步')}>
          <View className='icon hiking'></View>
          <Text>徒步</Text>
        </View>
        <View className='entry-item' onClick={() => handleQuickEntry('登山')}>
          <View className='icon climbing'></View>
          <Text>登山</Text>
        </View>
        <View className='entry-item' onClick={() => handleQuickEntry('露营')}>
          <View className='icon camping'></View>
          <Text>露营</Text>
        </View>
        <View className='entry-item' onClick={() => handleQuickEntry('骑行')}>
          <View className='icon cycling'></View>
          <Text>骑行</Text>
        </View>
      </View>

      <View className='section-title'>
        <Text>热门活动</Text>
        <Text className='more' onClick={handleViewMore}>查看更多 &gt;</Text>
      </View>

      {loading ? (
        <View className='loading-container'>
          <Loading type='spinner'>加载中...</Loading>
        </View>
      ) : activities.length === 0 ? (
        <View className='empty-container'>
          <Empty description='暂无活动' />
        </View>
      ) : (
        <View className='activity-list'>
          {activities.map((activity) => (
            <View
              key={activity.id}
              className='activity-card'
              onClick={() => handleActivityClick(activity.id)}
            >
              <View className='card-image'>
                {activity.coverUrl ? (
                  <Image src={activity.coverUrl} mode='aspectFill' />
                ) : (
                  <View className='placeholder-image'>
                    <Text className='placeholder-text'>{activity.route?.name?.substring(0, 2) || '活动'}</Text>
                  </View>
                )}
                <View className='date-badge'>
                  {formatDate(activity.startTime)}
                </View>
              </View>
              <View className='card-info'>
                <Text className='title'>{activity.title}</Text>
                <Text className='desc'>
                  {getDifficultyText(activity.route?.difficulty || 1)} · {activity.route?.distance || 0}km · 爬升{activity.route?.elevation || 0}m
                </Text>
                <View className='club-info'>
                  <Text className='club-name'>{activity.club?.name || '未知俱乐部'}</Text>
                  <Text className='enrollment-count'>
                    {activity._count?.enrollments || 0}/{activity.maxPeople}人
                  </Text>
                </View>
                <View className='footer'>
                  <Text className='price'>¥ {activity.price}</Text>
                  <Button
                    type='primary'
                    size='small'
                    onClick={(e) => handleEnrollClick(e, activity.id)}
                  >
                    立即报名
                  </Button>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
