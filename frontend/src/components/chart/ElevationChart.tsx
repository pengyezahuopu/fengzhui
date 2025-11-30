import { View, Text } from '@tarojs/components'
import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import EchartsCanvas from 'taro-react-echarts'
import { api } from '../../services/request'
import './ElevationChart.scss'

// 注册 ECharts 组件
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
])

interface ElevationChartProps {
  routeId: string
  height?: number | string
  className?: string
}

interface ElevationData {
  distance: number // 米
  elevation: number // 米
}

export default function ElevationChart({
  routeId,
  height = 200,
  className = '',
}: ElevationChartProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ElevationData[]>([])
  const chartRef = useRef<any>(null)

  useEffect(() => {
    loadElevationData()
  }, [routeId])

  const loadElevationData = async () => {
    try {
      setLoading(true)
      setError(null)
      const elevationData = await api.getRouteElevationProfile(routeId)
      setData(elevationData)
    } catch (err: any) {
      console.error('Failed to load elevation data:', err)
      setError('加载海拔数据失败')
    } finally {
      setLoading(false)
    }
  }

  const getChartOption = () => {
    if (data.length === 0) return {}

    // 计算统计数据
    const elevations = data.map((d) => d.elevation)
    const minEle = Math.min(...elevations)
    const maxEle = Math.max(...elevations)
    const totalDistance = data[data.length - 1].distance

    // 计算累计爬升
    let totalClimb = 0
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].elevation - data[i - 1].elevation
      if (diff > 0) totalClimb += diff
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const point = params[0]
          const distance = (point.data[0] / 1000).toFixed(2)
          const elevation = point.data[1]
          return `距离: ${distance}km\n海拔: ${elevation}m`
        },
        textStyle: {
          fontSize: 12,
        },
      },
      grid: {
        left: 45,
        right: 15,
        top: 20,
        bottom: 35,
      },
      xAxis: {
        type: 'value',
        name: '距离(km)',
        nameTextStyle: {
          fontSize: 10,
          color: '#999',
        },
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => (value / 1000).toFixed(1),
        },
        splitLine: {
          show: false,
        },
        max: totalDistance,
      },
      yAxis: {
        type: 'value',
        name: '海拔(m)',
        nameTextStyle: {
          fontSize: 10,
          color: '#999',
        },
        axisLabel: {
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e8e8e8',
          },
        },
        min: Math.floor(minEle / 50) * 50 - 50,
        max: Math.ceil(maxEle / 50) * 50 + 50,
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#667eea',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
                { offset: 1, color: 'rgba(102, 126, 234, 0.05)' },
              ],
            },
          },
          data: data.map((d) => [d.distance, d.elevation]),
          markPoint: {
            symbol: 'circle',
            symbolSize: 8,
            data: [
              {
                type: 'max',
                name: '最高点',
                label: {
                  show: true,
                  formatter: '{c}m',
                  fontSize: 10,
                },
              },
            ],
          },
        },
      ],
    }
  }

  if (loading) {
    return (
      <View className={`elevation-chart ${className}`} style={{ height }}>
        <View className='chart-loading'>
          <Text>加载海拔数据...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className={`elevation-chart ${className}`} style={{ height }}>
        <View className='chart-error'>
          <Text>{error}</Text>
        </View>
      </View>
    )
  }

  if (data.length === 0) {
    return (
      <View className={`elevation-chart ${className}`} style={{ height }}>
        <View className='chart-empty'>
          <Text>暂无海拔数据</Text>
        </View>
      </View>
    )
  }

  // 计算显示的统计数据
  const elevations = data.map((d) => d.elevation)
  const minEle = Math.min(...elevations)
  const maxEle = Math.max(...elevations)
  let totalClimb = 0
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].elevation - data[i - 1].elevation
    if (diff > 0) totalClimb += diff
  }

  return (
    <View className={`elevation-chart ${className}`}>
      <View className='chart-stats'>
        <View className='stat-item'>
          <Text className='stat-value'>{minEle}m</Text>
          <Text className='stat-label'>最低</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-value'>{maxEle}m</Text>
          <Text className='stat-label'>最高</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-value'>{Math.round(totalClimb)}m</Text>
          <Text className='stat-label'>累计爬升</Text>
        </View>
      </View>

      <View className='chart-container' style={{ height }}>
        <EchartsCanvas
          ref={chartRef}
          echarts={echarts}
          option={getChartOption()}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    </View>
  )
}
