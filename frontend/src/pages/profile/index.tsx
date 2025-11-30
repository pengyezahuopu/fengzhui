import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button, Loading } from '@nutui/nutui-react-taro'
import '@nutui/nutui-react-taro/dist/style.css'
import { useUser } from '../../store/userStore.tsx'
import { api } from '../../services/request'
import './index.scss'

interface Enrollment {
  id: string
  status: string
  createdAt: string
  activity: {
    id: string
    title: string
    coverUrl: string | null
    startTime: string
  }
}

export default function Profile() {
  const { userInfo, isLoggedIn, loading: userLoading, login, logout } = useUser()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  const [stats, setStats] = useState({
    totalEnrollments: 0,
    completedActivities: 0,
    totalDistance: 0
  })

  useEffect(() => {
    if (isLoggedIn && userInfo) {
      loadEnrollments()
    }
  }, [isLoggedIn, userInfo])

  const loadEnrollments = async () => {
    if (!userInfo) return

    try {
      setEnrollmentLoading(true)
      const userEnrollments = await api.getUserEnrollments(userInfo.id)
      setEnrollments(userEnrollments)

      // 计算统计数据
      const completed = userEnrollments.filter((e: Enrollment) => e.status === 'COMPLETED').length
      setStats({
        totalEnrollments: userEnrollments.length,
        completedActivities: completed,
        totalDistance: completed * 15 // 模拟数据
      })
    } catch (error) {
      console.error('Failed to load enrollments:', error)
    } finally {
      setEnrollmentLoading(false)
    }
  }

  const handleLogin = async () => {
    await login()
  }

  const handleLogout = () => {
    logout()
    setEnrollments([])
    setStats({ totalEnrollments: 0, completedActivities: 0, totalDistance: 0 })
  }

  const loading = userLoading || enrollmentLoading

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'PENDING': '待确认',
      'CONFIRMED': '已确认',
      'CANCELLED': '已取消',
      'COMPLETED': '已完成'
    }
    return statusMap[status] || status
  }

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      'PENDING': 'pending',
      'CONFIRMED': 'confirmed',
      'CANCELLED': 'cancelled',
      'COMPLETED': 'completed'
    }
    return classMap[status] || ''
  }

  const navigateToActivity = (activityId: string) => {
    Taro.navigateTo({ url: `/pages/activity/detail?id=${activityId}` })
  }

  if (loading) {
    return (
      <View className='profile-page' style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loading type='spinner'>加载中...</Loading>
      </View>
    )
  }

  return (
    <View className='profile-page'>
      {/* 用户头部 */}
      <View className='user-header'>
        <View className='user-info'>
          <View className='avatar'>
            {userInfo?.avatarUrl ? (
              <Image src={userInfo.avatarUrl} mode='aspectFill' />
            ) : (
              <View className='avatar-placeholder'>
                <Text>{userInfo?.nickname?.substring(0, 1) || '游'}</Text>
              </View>
            )}
          </View>
          <View className='info'>
            {userInfo ? (
              <>
                <Text className='nickname'>{userInfo.nickname}</Text>
                <Text className='phone'>{userInfo.phone || '未绑定手机号'}</Text>
              </>
            ) : (
              <Button className='login-btn' onClick={handleLogin}>
                点击登录
              </Button>
            )}
          </View>
        </View>
      </View>

      {/* 统计数据 */}
      <View className='stats-section'>
        <View className='stat-item'>
          <Text className='value'>{stats.totalEnrollments}</Text>
          <Text className='label'>报名活动</Text>
        </View>
        <View className='stat-item'>
          <Text className='value'>{stats.completedActivities}</Text>
          <Text className='label'>已完成</Text>
        </View>
        <View className='stat-item'>
          <Text className='value'>{stats.totalDistance}</Text>
          <Text className='label'>总里程(km)</Text>
        </View>
      </View>

      {/* 功能菜单 */}
      <View className='menu-section'>
        <Text className='section-title'>常用功能</Text>
        <View className='menu-list'>
          <View className='menu-item'>
            <View className='icon primary'>
              <Text>📋</Text>
            </View>
            <View className='content'>
              <Text className='title'>我的报名</Text>
              <Text className='desc'>查看报名记录和状态</Text>
            </View>
            <Text className='arrow'>›</Text>
          </View>
          <View className='menu-item'>
            <View className='icon success'>
              <Text>⭐</Text>
            </View>
            <View className='content'>
              <Text className='title'>我的收藏</Text>
              <Text className='desc'>收藏的活动和路线</Text>
            </View>
            <Text className='arrow'>›</Text>
          </View>
          <View className='menu-item'>
            <View className='icon warning'>
              <Text>🏆</Text>
            </View>
            <View className='content'>
              <Text className='title'>我的成就</Text>
              <Text className='desc'>户外运动成就徽章</Text>
            </View>
            <Text className='arrow'>›</Text>
          </View>
          <View className='menu-item'>
            <View className='icon info'>
              <Text>⚙️</Text>
            </View>
            <View className='content'>
              <Text className='title'>设置</Text>
              <Text className='desc'>账号与通知设置</Text>
            </View>
            <Text className='arrow'>›</Text>
          </View>
        </View>
      </View>

      {/* 我的报名 */}
      {userInfo && (
        <View className='enrollments-section'>
          <View className='section-header'>
            <Text className='title'>最近报名</Text>
            <Text className='more'>查看全部 ›</Text>
          </View>
          {enrollments.length > 0 ? (
            <View className='enrollment-list'>
              {enrollments.slice(0, 3).map((enrollment) => (
                <View
                  key={enrollment.id}
                  className='enrollment-item'
                  onClick={() => navigateToActivity(enrollment.activity.id)}
                >
                  <View className='activity-image'>
                    {enrollment.activity.coverUrl ? (
                      <Image src={enrollment.activity.coverUrl} mode='aspectFill' />
                    ) : (
                      <View className='image-placeholder'>
                        <Text>{enrollment.activity.title.substring(0, 2)}</Text>
                      </View>
                    )}
                  </View>
                  <View className='activity-info'>
                    <Text className='activity-title'>{enrollment.activity.title}</Text>
                    <Text className='activity-time'>{formatDateTime(enrollment.activity.startTime)}</Text>
                  </View>
                  <Text className={`status-tag ${getStatusClass(enrollment.status)}`}>
                    {getStatusText(enrollment.status)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className='empty-state'>
              <Text className='empty-text'>暂无报名记录</Text>
              <Button type='primary' size='small' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
                去看看活动
              </Button>
            </View>
          )}
        </View>
      )}

      {/* 退出登录 */}
      {userInfo && (
        <View className='logout-section'>
          <Button block type='default' onClick={handleLogout}>
            退出登录
          </Button>
        </View>
      )}
    </View>
  )
}
