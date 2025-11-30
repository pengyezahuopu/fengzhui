import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { api } from '../services/request'

export interface UserInfo {
  id: string
  nickname: string
  avatarUrl: string | null
  phone: string | null
  openId?: string
}

interface UserContextType {
  userInfo: UserInfo | null
  isLoggedIn: boolean
  loading: boolean
  login: (userId?: string) => Promise<void>
  logout: () => void
  refreshUserInfo: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 初始化时检查本地存储的用户信息
    initUserInfo()
  }, [])

  const initUserInfo = async () => {
    try {
      const userId = Taro.getStorageSync('userId')
      const token = Taro.getStorageSync('token')

      // 只有同时存在 userId 和 token 时才尝试获取用户信息
      if (userId && token) {
        await fetchUserInfo(userId)
      } else {
        // 清理不完整的登录状态
        Taro.removeStorageSync('userId')
        Taro.removeStorageSync('token')
      }
    } catch (error) {
      console.error('Failed to init user info:', error)
      // 初始化失败时清理存储
      Taro.removeStorageSync('userId')
      Taro.removeStorageSync('token')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserInfo = async (userId: string) => {
    try {
      const user = await api.getUser(userId)
      setUserInfo(user)
      Taro.setStorageSync('userId', userId)
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      // 清除无效的用户ID和token
      Taro.removeStorageSync('userId')
      Taro.removeStorageSync('token')
      setUserInfo(null)
    }
  }

  const login = async (userId?: string) => {
    setLoading(true)
    try {
      // 模拟登录 - 实际项目中应该调用微信登录API
      // H5 环境使用模拟 openId，小程序环境应该使用 wx.login 获取真实 openId
      const mockOpenId = userId || 'test_openid_' + Date.now()
      const mockNickname = '测试用户'

      // 调用后端登录接口，获取 token 和用户信息
      const response = await api.login(mockOpenId, mockNickname) as any

      // 保存 token 和用户信息
      if (response.token) {
        Taro.setStorageSync('token', response.token)
      }

      if (response.user) {
        setUserInfo(response.user)
        Taro.setStorageSync('userId', response.user.id)
      }

      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      console.error('Login failed:', error)
      Taro.showToast({ title: '登录失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    // 清理 userId 和 token
    Taro.removeStorageSync('userId')
    Taro.removeStorageSync('token')
    setUserInfo(null)
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  const refreshUserInfo = async () => {
    const userId = Taro.getStorageSync('userId')
    if (userId) {
      await fetchUserInfo(userId)
    }
  }

  const value: UserContextType = {
    userInfo,
    isLoggedIn: !!userInfo,
    loading,
    login,
    logout,
    refreshUserInfo
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export default UserContext
