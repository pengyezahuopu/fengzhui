import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button, Dialog, Input, Loading, Tag } from '@nutui/nutui-react-taro'
import '@nutui/nutui-react-taro/dist/style.css'
import { api } from '../../services/request'
import './detail.scss'

interface ActivityDetail {
  id: string
  title: string
  coverUrl: string | null
  startTime: string
  endTime: string
  price: string
  maxPeople: number
  minPeople: number
  status: string
  route: {
    id: string
    name: string
    difficulty: number
    distance: number
    elevation: number
  }
  club: {
    id: string
    name: string
    logo: string | null
    description: string | null
  }
  leader: {
    id: string
    realName: string
    bio: string | null
    rating: number
    experience: number
    user: {
      nickname: string
      avatarUrl: string | null
    }
  }
  enrollments: Array<{
    id: string
    status: string
    user: {
      id: string
      nickname: string
      avatarUrl: string | null
    }
  }>
  _count: {
    enrollments: number
  }
}

export default function ActivityDetail() {
  const router = useRouter()
  const { id } = router.params

  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollDialogVisible, setEnrollDialogVisible] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      loadActivityDetail()
    }
  }, [id])

  const loadActivityDetail = async () => {
    try {
      setLoading(true)
      const data = await api.getActivityDetail(id!)
      setActivity(data)
    } catch (error) {
      console.error('Failed to load activity:', error)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const getDifficultyText = (level: number) => {
    const texts = ['', '入门', '初级', '中级', '进阶', '专业']
    return texts[level] || '未知'
  }

  const getDifficultyColor = (level: number) => {
    const colors = ['', '#52c41a', '#1890ff', '#faad14', '#f5222d', '#722ed1']
    return colors[level] || '#999'
  }

  const handleRouteClick = () => {
    if (activity?.route?.id) {
      Taro.navigateTo({
        url: `/pages/route/detail?id=${activity.route.id}`,
      })
    }
  }

  const handleEnrollClick = () => {
    // 检查用户是否登录（简化版本，实际应检查token）
    const userId = Taro.getStorageSync('userId')
    if (!userId) {
      // 模拟登录
      const mockUserId = '79a17f5a-a7c3-49a8-9bfd-10250c633d29'
      Taro.setStorageSync('userId', mockUserId)
    }
    setEnrollDialogVisible(true)
  }

  const handleEnrollSubmit = async () => {
    if (!contactName.trim()) {
      Taro.showToast({ title: '请输入联系人姓名', icon: 'none' })
      return
    }
    if (!contactPhone.trim() || !/^1\d{10}$/.test(contactPhone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    try {
      setSubmitting(true)
      const userId = Taro.getStorageSync('userId')
      await api.createEnrollment({
        activityId: id!,
        userId,
        contactName,
        contactPhone,
      })
      setEnrollDialogVisible(false)
      Taro.showToast({ title: '报名成功', icon: 'success' })
      loadActivityDetail() // 刷新数据
    } catch (error: any) {
      Taro.showToast({ title: error.message || '报名失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View className='detail-page loading'>
        <Loading type='spinner'>加载中...</Loading>
      </View>
    )
  }

  if (!activity) {
    return (
      <View className='detail-page error'>
        <Text>活动不存在</Text>
      </View>
    )
  }

  const isFull = (activity._count?.enrollments || 0) >= activity.maxPeople
  const canEnroll = activity.status === 'PUBLISHED' && !isFull

  return (
    <View className='detail-page'>
      {/* 顶部大图 */}
      <View className='cover-section'>
        {activity.coverUrl ? (
          <Image src={activity.coverUrl} mode='aspectFill' className='cover-image' />
        ) : (
          <View className='cover-placeholder'>
            <Text className='cover-text'>{activity.route?.name?.substring(0, 2) || '活动'}</Text>
          </View>
        )}
      </View>

      {/* 基本信息 */}
      <View className='info-section'>
        <Text className='title'>{activity.title}</Text>

        <View className='tags' onClick={handleRouteClick}>
          <Tag color={getDifficultyColor(activity.route?.difficulty || 1)}>
            {getDifficultyText(activity.route?.difficulty || 1)}
          </Tag>
          <Tag plain>{activity.route?.distance || 0}km</Tag>
          <Tag plain>爬升{activity.route?.elevation || 0}m</Tag>
          <Text className='route-link'>查看线路 &gt;</Text>
        </View>

        <View className='meta-info'>
          <View className='meta-item'>
            <Text className='label'>活动时间</Text>
            <Text className='value'>{formatDateTime(activity.startTime)}</Text>
          </View>
          <View className='meta-item'>
            <Text className='label'>报名人数</Text>
            <Text className='value highlight'>
              {activity._count?.enrollments || 0}/{activity.maxPeople}人
              {isFull && <Text className='full-tag'>已满</Text>}
            </Text>
          </View>
          <View className='meta-item'>
            <Text className='label'>最少成行</Text>
            <Text className='value'>{activity.minPeople}人</Text>
          </View>
        </View>
      </View>

      {/* 领队信息 */}
      <View className='leader-section'>
        <Text className='section-title'>领队信息</Text>
        <View className='leader-card'>
          <View className='avatar'>
            {activity.leader?.user?.avatarUrl ? (
              <Image src={activity.leader.user.avatarUrl} mode='aspectFill' />
            ) : (
              <View className='avatar-placeholder'>
                <Text>{activity.leader?.user?.nickname?.substring(0, 1) || 'L'}</Text>
              </View>
            )}
          </View>
          <View className='leader-info'>
            <Text className='name'>{activity.leader?.realName || activity.leader?.user?.nickname}</Text>
            <Text className='stats'>
              带队{activity.leader?.experience || 0}次 · 评分{activity.leader?.rating || 5}
            </Text>
            {activity.leader?.bio && (
              <Text className='bio'>{activity.leader.bio}</Text>
            )}
          </View>
        </View>
      </View>

      {/* 俱乐部信息 */}
      <View className='club-section'>
        <Text className='section-title'>主办方</Text>
        <View className='club-card'>
          <Text className='club-name'>{activity.club?.name}</Text>
          {activity.club?.description && (
            <Text className='club-desc'>{activity.club.description}</Text>
          )}
        </View>
      </View>

      {/* 已报名人员 */}
      {activity.enrollments && activity.enrollments.length > 0 && (
        <View className='enrollments-section'>
          <Text className='section-title'>已报名</Text>
          <View className='enrollments-list'>
            {activity.enrollments.slice(0, 5).map((enrollment) => (
              <View key={enrollment.id} className='enrollment-avatar'>
                {enrollment.user?.avatarUrl ? (
                  <Image src={enrollment.user.avatarUrl} mode='aspectFill' />
                ) : (
                  <View className='avatar-placeholder small'>
                    <Text>{enrollment.user?.nickname?.substring(0, 1) || 'U'}</Text>
                  </View>
                )}
              </View>
            ))}
            {activity.enrollments.length > 5 && (
              <View className='more-count'>+{activity.enrollments.length - 5}</View>
            )}
          </View>
        </View>
      )}

      {/* 底部报名栏 */}
      <View className='bottom-bar'>
        <View className='price-info'>
          <Text className='price'>¥{activity.price}</Text>
          <Text className='unit'>/人</Text>
        </View>
        <Button
          type='primary'
          size='large'
          disabled={!canEnroll}
          onClick={handleEnrollClick}
        >
          {isFull ? '已满员' : activity.status !== 'PUBLISHED' ? '暂不可报名' : '立即报名'}
        </Button>
      </View>

      {/* 报名弹窗 */}
      <Dialog
        title='报名信息'
        visible={enrollDialogVisible}
        onCancel={() => setEnrollDialogVisible(false)}
        onConfirm={handleEnrollSubmit}
        confirmText={submitting ? '提交中...' : '确认报名'}
      >
        <View className='enroll-form'>
          <View className='form-item'>
            <Text className='label'>联系人姓名</Text>
            <Input
              placeholder='请输入姓名'
              value={contactName}
              onChange={(val) => setContactName(val)}
            />
          </View>
          <View className='form-item'>
            <Text className='label'>联系电话</Text>
            <Input
              type='tel'
              placeholder='请输入手机号'
              value={contactPhone}
              onChange={(val) => setContactPhone(val)}
            />
          </View>
        </View>
      </Dialog>
    </View>
  )
}
