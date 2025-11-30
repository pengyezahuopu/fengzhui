import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { Loading } from '@nutui/nutui-react-taro'
import '@nutui/nutui-react-taro/dist/style.css'
import { api } from '../../services/request'
import { ActivityCard, ActivityCardData } from '../../components/activity'
import './index.scss'

const DIFFICULTY_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 1, label: '入门' },
  { value: 2, label: '初级' },
  { value: 3, label: '中级' },
  { value: 4, label: '进阶' },
  { value: 5, label: '专业' }
]

export default function Activities() {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityCardData[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadActivities(true)
  }, [selectedDifficulty])

  const loadActivities = async (refresh = false) => {
    try {
      setError(null)
      if (refresh) {
        setLoading(true)
        setPage(1)
      } else {
        setLoadingMore(true)
      }

      const currentPage = refresh ? 1 : page
      const response = await api.getActivities({
        page: currentPage,
        limit: 10,
        status: 'PUBLISHED'
      })

      // Handle different response structures
      const data = Array.isArray(response) ? response : (response.data || [])
      const total = response.pagination?.total || 0

      // 根据难度筛选
      let filteredData = data

      if (selectedDifficulty > 0) {
        filteredData = data.filter((a: ActivityCardData) => a.route?.difficulty === selectedDifficulty)
      }

      // 根据搜索词筛选
      if (searchText.trim()) {
        const keyword = searchText.toLowerCase()
        filteredData = filteredData.filter((a: ActivityCardData) =>
          a.title.toLowerCase().includes(keyword) ||
          a.route?.name?.toLowerCase().includes(keyword) ||
          a.club?.name?.toLowerCase().includes(keyword)
        )
      }

      if (refresh) {
        setActivities(filteredData)
      } else {
        setActivities(prev => [...prev, ...filteredData])
      }

      setHasMore(filteredData.length >= 10)
      setPage(currentPage + 1)
    } catch (error: any) {
      console.error('Failed to load activities:', error)
      setError(error?.message || '加载失败，请稍后重试')
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleSearch = useCallback(() => {
    loadActivities(true)
  }, [searchText, selectedDifficulty])

  const navigateToDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/activity/detail?id=${id}` })
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadActivities(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    loadActivities(true)
  }

  const resetFilters = () => {
    setSearchText('')
    setSelectedDifficulty(0)
  }

  // 判断是否为筛选导致的空结果
  const isFiltered = searchText.trim() !== '' || selectedDifficulty > 0

  return (
    <View className='activities-page'>
      {/* 搜索栏 */}
      <View className='search-section'>
        <View className='search-input'>
          <Text className='search-icon'>🔍</Text>
          <Input
            placeholder='搜索活动名称、路线'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            onConfirm={handleSearch}
          />
        </View>
      </View>

      {/* 筛选栏 */}
      <View className='filter-bar'>
        {DIFFICULTY_OPTIONS.map((option) => (
          <View
            key={option.value}
            className={`filter-item ${selectedDifficulty === option.value ? 'active' : ''}`}
            onClick={() => setSelectedDifficulty(option.value)}
          >
            {option.label}
          </View>
        ))}
      </View>

      {/* 活动列表 */}
      {loading ? (
        <View className='loading-container'>
          <Loading type='spinner'>加载中...</Loading>
        </View>
      ) : error ? (
        <View className='empty-container'>
          <Text className='empty-icon'>⚠️</Text>
          <Text className='empty-text'>{error}</Text>
          <View className='empty-action' onClick={handleRetry}>
            <Text className='action-text'>点击重试</Text>
          </View>
        </View>
      ) : activities.length === 0 ? (
        <View className='empty-container'>
          <Text className='empty-icon'>📭</Text>
          <Text className='empty-text'>
            {isFiltered ? '没有符合筛选条件的活动' : '暂无活动数据'}
          </Text>
          <Text className='empty-hint'>
            {isFiltered
              ? '试试调整筛选条件或搜索关键词'
              : '更多精彩活动即将上线，敬请期待'}
          </Text>
          {isFiltered && (
            <View className='empty-action' onClick={resetFilters}>
              <Text className='action-text'>清除筛选</Text>
            </View>
          )}
        </View>
      ) : (
        <View className='activity-list'>
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={navigateToDetail}
            />
          ))}

          {/* 加载更多 */}
          <View className='load-more' onClick={handleLoadMore}>
            {loadingMore ? (
              <Text className='loading-text'>加载中...</Text>
            ) : hasMore ? (
              <Text className='loading-text'>点击加载更多</Text>
            ) : (
              <Text className='no-more-text'>没有更多了</Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
