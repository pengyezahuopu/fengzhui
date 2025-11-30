import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Button, Progress } from '@nutui/nutui-react-taro'
import { uploadGpxFile, GpxUploadError, GpxUploadResult } from '../../services/request'
import './GpxUploader.scss'

interface GpxUploaderProps {
  onSuccess?: (result: GpxUploadResult) => void
  onError?: (error: GpxUploadError) => void
  routeOptions?: {
    name?: string
    description?: string
    region?: string
    difficulty?: number
  }
}

type UploadStatus = 'idle' | 'selecting' | 'uploading' | 'success' | 'error'

// 错误码对应的中文提示
const ERROR_MESSAGES: Record<string, { title: string; icon: string }> = {
  GPX_EMPTY: { title: '文件为空', icon: '📄' },
  GPX_NOT_XML: { title: '格式错误', icon: '❌' },
  GPX_NO_ROOT: { title: '结构错误', icon: '🏗️' },
  GPX_VERSION_UNSUPPORTED: { title: '版本不支持', icon: '📋' },
  GPX_NO_POINTS: { title: '无轨迹点', icon: '📍' },
  GPX_SINGLE_POINT: { title: '点数不足', icon: '📍' },
  GPX_INVALID_COORDINATES: { title: '坐标无效', icon: '🗺️' },
  GPX_COORDINATES_OUT_OF_RANGE: { title: '坐标超范围', icon: '🌍' },
  GPX_PARSE_ERROR: { title: '解析失败', icon: '⚠️' },
  NETWORK_ERROR: { title: '网络错误', icon: '📶' },
  UPLOAD_FAILED: { title: '上传失败', icon: '❌' },
}

export default function GpxUploader({
  onSuccess,
  onError,
  routeOptions = {},
}: GpxUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<GpxUploadError | null>(null)
  const [result, setResult] = useState<GpxUploadResult | null>(null)
  const [fileName, setFileName] = useState('')

  const handleSelectFile = async () => {
    try {
      setStatus('selecting')
      setError(null)

      // 选择文件
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['gpx'],
      })

      if (res.tempFiles.length === 0) {
        setStatus('idle')
        return
      }

      const file = res.tempFiles[0]
      setFileName(file.name)

      // 检查文件大小（限制 10MB）
      if (file.size > 10 * 1024 * 1024) {
        const sizeError: GpxUploadError = {
          code: 'FILE_TOO_LARGE',
          message: '文件大小超过限制',
          suggestion: '请上传小于 10MB 的 GPX 文件',
        }
        setError(sizeError)
        setStatus('error')
        onError?.(sizeError)
        return
      }

      // 开始上传
      setStatus('uploading')
      setProgress(0)

      const uploadResult = await uploadGpxFile(file.path, routeOptions, {
        onProgress: (p) => setProgress(p),
        onSuccess: (data) => {
          setResult(data)
          setStatus('success')
          onSuccess?.(data)
        },
        onError: (err) => {
          setError(err)
          setStatus('error')
          onError?.(err)
        },
      })

      setResult(uploadResult)
      setStatus('success')
    } catch (err: any) {
      // 用户取消选择
      if (err.errMsg?.includes('cancel')) {
        setStatus('idle')
        return
      }

      const uploadError: GpxUploadError = {
        code: 'UNKNOWN_ERROR',
        message: err.message || '未知错误',
        suggestion: '请稍后重试',
      }
      setError(uploadError)
      setStatus('error')
      onError?.(uploadError)
    }
  }

  const handleRetry = () => {
    setStatus('idle')
    setError(null)
    setProgress(0)
    setResult(null)
    setFileName('')
  }

  const getErrorInfo = (errorCode: string) => {
    return ERROR_MESSAGES[errorCode] || { title: '未知错误', icon: '❓' }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }

  return (
    <View className='gpx-uploader'>
      {/* 空闲状态 - 显示上传按钮 */}
      {status === 'idle' && (
        <View className='upload-area' onClick={handleSelectFile}>
          <View className='upload-icon'>📁</View>
          <Text className='upload-title'>选择 GPX 文件</Text>
          <Text className='upload-hint'>支持 GPX 1.0/1.1 格式，最大 10MB</Text>
        </View>
      )}

      {/* 选择中 */}
      {status === 'selecting' && (
        <View className='upload-area loading'>
          <View className='upload-icon'>⏳</View>
          <Text className='upload-title'>请选择文件...</Text>
        </View>
      )}

      {/* 上传中 - 显示进度条 */}
      {status === 'uploading' && (
        <View className='upload-progress'>
          <View className='progress-header'>
            <Text className='file-name'>{fileName}</Text>
            <Text className='progress-text'>{progress}%</Text>
          </View>
          <Progress percent={progress} color='#667eea' />
          <Text className='progress-hint'>
            {progress < 100 ? '正在上传...' : '正在解析轨迹...'}
          </Text>
        </View>
      )}

      {/* 上传成功 - 显示结果预览 */}
      {status === 'success' && result && (
        <View className='upload-success'>
          <View className='success-header'>
            <View className='success-icon'>✅</View>
            <Text className='success-title'>上传成功</Text>
          </View>

          <View className='result-preview'>
            <Text className='route-name'>{result.name}</Text>

            <View className='stats-row'>
              <View className='stat-item'>
                <Text className='stat-value'>{result.distance}km</Text>
                <Text className='stat-label'>总距离</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{result.elevation}m</Text>
                <Text className='stat-label'>累计爬升</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{formatTime(result.estimatedTime)}</Text>
                <Text className='stat-label'>预计用时</Text>
              </View>
            </View>

            <View className='point-info'>
              <Text className='point-count'>轨迹点数: {result.pointCount}</Text>
            </View>
          </View>

          <Button
            className='retry-btn'
            size='small'
            fill='outline'
            onClick={handleRetry}
          >
            重新上传
          </Button>
        </View>
      )}

      {/* 上传失败 - 显示详细错误 */}
      {status === 'error' && error && (
        <View className='upload-error'>
          <View className='error-header'>
            <View className='error-icon'>{getErrorInfo(error.code).icon}</View>
            <Text className='error-title'>{getErrorInfo(error.code).title}</Text>
          </View>

          <View className='error-detail'>
            <Text className='error-message'>{error.message}</Text>
            {error.suggestion && (
              <Text className='error-suggestion'>{error.suggestion}</Text>
            )}
            {error.detail && (
              <Text className='error-technical'>技术详情: {error.detail}</Text>
            )}
          </View>

          <View className='error-code'>错误码: {error.code}</View>

          <Button
            className='retry-btn'
            type='primary'
            onClick={handleRetry}
          >
            重新选择文件
          </Button>
        </View>
      )}
    </View>
  )
}
