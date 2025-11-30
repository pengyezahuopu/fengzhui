import { View, Map, CoverView, Text } from '@tarojs/components'
import { useState, useMemo } from 'react'
import './RouteMap.scss'

interface GeoJsonLineString {
  type: 'LineString'
  coordinates: number[][] // [lon, lat]
}

interface RouteMapProps {
  geojson?: GeoJsonLineString | null
  startPoint?: { lat: number; lon: number } | null
  endPoint?: { lat: number; lon: number } | null
  height?: number | string
  showMarkers?: boolean
  showRoute?: boolean
  className?: string
}

interface MapPolyline {
  points: { latitude: number; longitude: number }[]
  color: string
  width: number
  dottedLine?: boolean
  arrowLine?: boolean
  borderColor?: string
  borderWidth?: number
}

interface MapMarker {
  id: number
  latitude: number
  longitude: number
  iconPath: string
  width?: number
  height?: number
  callout?: {
    content: string
    display?: 'BYCLICK' | 'ALWAYS'
    bgColor?: string
    color?: string
    fontSize?: number
    borderRadius?: number
    padding?: number
  }
}

export default function RouteMap({
  geojson,
  startPoint,
  endPoint,
  height = 300,
  showMarkers = true,
  showRoute = true,
  className = '',
}: RouteMapProps) {
  const [mapReady] = useState(true)

  // 计算地图中心点
  const center = useMemo(() => {
    if (geojson && geojson.coordinates.length > 0) {
      const coords = geojson.coordinates
      const sumLat = coords.reduce((acc, c) => acc + c[1], 0)
      const sumLon = coords.reduce((acc, c) => acc + c[0], 0)
      return {
        latitude: sumLat / coords.length,
        longitude: sumLon / coords.length,
      }
    }
    if (startPoint) {
      return {
        latitude: startPoint.lat,
        longitude: startPoint.lon,
      }
    }
    // 默认北京中心
    return {
      latitude: 39.9,
      longitude: 116.4,
    }
  }, [geojson, startPoint])

  // 计算合适的缩放级别
  const scale = useMemo(() => {
    if (!geojson || geojson.coordinates.length < 2) return 14

    const coords = geojson.coordinates
    const lats = coords.map((c) => c[1])
    const lons = coords.map((c) => c[0])

    const latSpan = Math.max(...lats) - Math.min(...lats)
    const lonSpan = Math.max(...lons) - Math.min(...lons)
    const maxSpan = Math.max(latSpan, lonSpan)

    // 根据跨度估算缩放级别
    if (maxSpan > 0.5) return 10
    if (maxSpan > 0.2) return 11
    if (maxSpan > 0.1) return 12
    if (maxSpan > 0.05) return 13
    if (maxSpan > 0.02) return 14
    return 15
  }, [geojson])

  // 构建轨迹线
  const polyline: MapPolyline[] = useMemo(() => {
    if (!showRoute || !geojson || geojson.coordinates.length < 2) return []

    return [
      {
        points: geojson.coordinates.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        })),
        color: '#4A90E2',
        width: 4,
        arrowLine: true,
        borderColor: '#2D6CB5',
        borderWidth: 1,
      },
    ]
  }, [geojson, showRoute])

  // 构建标记点 (使用 callout 显示起终点，不依赖自定义图标)
  const markers: MapMarker[] = useMemo(() => {
    if (!showMarkers) return []

    const result: MapMarker[] = []

    if (startPoint) {
      result.push({
        id: 1,
        latitude: startPoint.lat,
        longitude: startPoint.lon,
        iconPath: '', // 使用空字符串会显示默认标记
        width: 28,
        height: 28,
        callout: {
          content: '起点',
          display: 'ALWAYS',
          bgColor: '#52c41a',
          color: '#fff',
          fontSize: 12,
          borderRadius: 4,
          padding: 6,
        },
      })
    }

    if (endPoint && (endPoint.lat !== startPoint?.lat || endPoint.lon !== startPoint?.lon)) {
      result.push({
        id: 2,
        latitude: endPoint.lat,
        longitude: endPoint.lon,
        iconPath: '',
        width: 28,
        height: 28,
        callout: {
          content: '终点',
          display: 'ALWAYS',
          bgColor: '#f5222d',
          color: '#fff',
          fontSize: 12,
          borderRadius: 4,
          padding: 6,
        },
      })
    }

    return result
  }, [startPoint, endPoint, showMarkers])

  if (!geojson && !startPoint) {
    return (
      <View className={`route-map-placeholder ${className}`} style={{ height }}>
        <Text className='placeholder-text'>暂无轨迹数据</Text>
      </View>
    )
  }

  return (
    <View className={`route-map-container ${className}`}>
      <Map
        className='route-map'
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        latitude={center.latitude}
        longitude={center.longitude}
        scale={scale}
        polyline={polyline}
        markers={markers as any}
        showLocation={false}
        enableZoom
        enableScroll
        onError={(e) => console.error('Map error:', e)}
      >
        {!mapReady && (
          <CoverView className='map-loading'>
            <Text>地图加载中...</Text>
          </CoverView>
        )}
      </Map>
    </View>
  )
}
