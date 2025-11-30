import Taro from '@tarojs/taro';

// 根据环境配置API基础URL
const BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000'
  : 'https://api.fengzhui.com';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
}

interface ApiResponse<T = any> {
  data: T;
  statusCode: number;
}

// 封装请求方法
export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {} } = options;

  // 获取存储的token（如果有）
  const token = Taro.getStorageSync('token');
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.data as T;
    } else {
      throw new Error(response.data?.message || '请求失败');
    }
  } catch (error: any) {
    console.error('API Request Error:', error);
    Taro.showToast({
      title: error.message || '网络错误',
      icon: 'none',
    });
    throw error;
  }
}

// GPX 上传进度回调类型
export interface UploadProgressCallback {
  onProgress?: (progress: number) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: GpxUploadError) => void;
}

// GPX 上传错误类型
export interface GpxUploadError {
  code: string;
  message: string;
  suggestion?: string;
  detail?: string;
}

// GPX 上传结果
export interface GpxUploadResult {
  id: string;
  name: string;
  distance: number;
  elevation: number;
  estimatedTime: number;
  pointCount: number;
  geojson: any;
  startPoint: { lat: number; lon: number };
  endPoint: { lat: number; lon: number };
}

// 上传 GPX 文件（带进度）
export async function uploadGpxFile(
  filePath: string,
  options: {
    name?: string;
    description?: string;
    region?: string;
    difficulty?: number;
  } = {},
  callbacks?: UploadProgressCallback
): Promise<GpxUploadResult> {
  const token = Taro.getStorageSync('token');
  const formData: Record<string, any> = {};

  if (options.name) formData.name = options.name;
  if (options.description) formData.description = options.description;
  if (options.region) formData.region = options.region;
  if (options.difficulty) formData.difficulty = String(options.difficulty);

  return new Promise((resolve, reject) => {
    const uploadTask = Taro.uploadFile({
      url: `${BASE_URL}/routes/upload-gpx`,
      filePath,
      name: 'file',
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data);
            callbacks?.onSuccess?.(data);
            resolve(data);
          } catch {
            const error: GpxUploadError = {
              code: 'PARSE_ERROR',
              message: '响应解析失败',
              suggestion: '请稍后重试',
            };
            callbacks?.onError?.(error);
            reject(error);
          }
        } else {
          let error: GpxUploadError;
          try {
            const errData = JSON.parse(res.data);
            error = {
              code: errData.code || 'UPLOAD_FAILED',
              message: errData.message || '上传失败',
              suggestion: errData.suggestion || '请检查文件格式后重试',
              detail: errData.detail,
            };
          } catch {
            error = {
              code: 'UPLOAD_FAILED',
              message: `上传失败 (${res.statusCode})`,
              suggestion: '请稍后重试',
            };
          }
          callbacks?.onError?.(error);
          reject(error);
        }
      },
      fail: (err) => {
        const error: GpxUploadError = {
          code: 'NETWORK_ERROR',
          message: '网络连接失败',
          suggestion: '请检查网络连接后重试',
          detail: err.errMsg,
        };
        callbacks?.onError?.(error);
        reject(error);
      },
    });

    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      callbacks?.onProgress?.(res.progress);
    });
  });
}

// API方法封装
export const api = {
  // 用户相关
  login: (openId: string, nickname?: string) =>
    request({ url: '/users/login', method: 'POST', data: { openId, nickname } }),

  getUser: (id: string) =>
    request({ url: `/users/${id}` }),

  getUserEnrollments: (userId: string) =>
    request({ url: `/users/${userId}/enrollments` }),

  // 活动相关
  getActivities: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/activities${query}` });
  },

  getRecommendedActivities: (limit: number = 10) =>
    request({ url: `/activities/recommended?limit=${limit}` }),

  getActivityDetail: (id: string) =>
    request({ url: `/activities/${id}` }),

  // 报名相关
  createEnrollment: (data: {
    activityId: string;
    userId: string;
    contactName: string;
    contactPhone: string;
  }) =>
    request({ url: '/enrollments', method: 'POST', data }),

  cancelEnrollment: (id: string, userId: string) =>
    request({ url: `/enrollments/${id}`, method: 'DELETE', data: { userId } }),

  payEnrollment: (id: string) =>
    request({ url: `/enrollments/${id}/pay`, method: 'POST' }),

  // 线路相关
  getRoutes: (params?: { withGeo?: boolean; difficulty?: number; region?: string }) => {
    const query = params
      ? `?${new URLSearchParams(params as any).toString()}`
      : '';
    return request({ url: `/routes${query}` });
  },

  getRoutesWithGeo: () =>
    request({ url: '/routes?withGeo=true' }),

  getRouteDetail: (id: string, withGeo: boolean = false) =>
    request({ url: `/routes/${id}${withGeo ? '?withGeo=true' : ''}` }),

  getNearbyRoutes: (lat: number, lon: number, radius: number = 50) =>
    request({ url: `/routes/nearby/search?lat=${lat}&lon=${lon}&radius=${radius}` }),

  getRouteElevationProfile: (id: string) =>
    request<{ distance: number; elevation: number }[]>({
      url: `/routes/${id}/elevation`,
    }),

  // 俱乐部相关
  getClubs: () =>
    request({ url: '/clubs' }),

  getClubDetail: (id: string) =>
    request({ url: `/clubs/${id}` }),

  // ==================== Phase 3: 社交功能 ====================

  // 帖子相关
  createPost: (data: {
    content: string;
    imageUrls?: string[];
    activityId?: string;
    routeId?: string;
    circleId?: string;
    tags?: string[];
  }) =>
    request({
      url: '/posts',
      method: 'POST',
      data,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  getPosts: (params?: { userId?: string; circleId?: string; cursor?: string; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/posts${query}` });
  },

  getPostDetail: (id: string) =>
    request({ url: `/posts/${id}` }),

  deletePost: (id: string) =>
    request({
      url: `/posts/${id}`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  likePost: (id: string) =>
    request({
      url: `/posts/${id}/like`,
      method: 'POST',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  unlikePost: (id: string) =>
    request({
      url: `/posts/${id}/like`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  // 评论相关
  getComments: (postId: string, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({ url: `/posts/${postId}/comments${query}` });
  },

  createComment: (postId: string, data: { content: string; parentId?: string }) =>
    request({
      url: `/posts/${postId}/comments`,
      method: 'POST',
      data,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  deleteComment: (id: string) =>
    request({
      url: `/comments/${id}`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  likeComment: (id: string) =>
    request({
      url: `/comments/${id}/like`,
      method: 'POST',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  // 关注相关
  followUser: (userId: string) =>
    request({
      url: `/users/${userId}/follow`,
      method: 'POST',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  unfollowUser: (userId: string) =>
    request({
      url: `/users/${userId}/follow`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  getFollowers: (userId: string, cursor?: string) => {
    const query = cursor ? `?cursor=${cursor}` : '';
    return request({ url: `/users/${userId}/followers${query}` });
  },

  getFollowing: (userId: string, cursor?: string) => {
    const query = cursor ? `?cursor=${cursor}` : '';
    return request({ url: `/users/${userId}/following${query}` });
  },

  getFollowStats: (userId: string) =>
    request({ url: `/users/${userId}/follow-stats` }),

  // Feed 流
  getPersonalFeed: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({
      url: `/feed${query}`,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    });
  },

  getRecommendFeed: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({ url: `/feed/recommend${query}` });
  },

  getUserFeed: (userId: string, cursor?: string) => {
    const query = cursor ? `?cursor=${cursor}` : '';
    return request({ url: `/feed/user/${userId}${query}` });
  },

  // ==================== Phase 3.2: 圈子与相册 ====================

  // 圈子相关
  createCircle: (data: {
    name: string;
    description?: string;
    icon?: string;
    coverUrl?: string;
    category?: string;
    clubId?: string;
  }) =>
    request({
      url: '/circles',
      method: 'POST',
      data,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  getCircles: (params?: { category?: string; keyword?: string; cursor?: string; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/circles${query}` });
  },

  getCircleDetail: (id: string) =>
    request({
      url: `/circles/${id}`,
      header: { 'x-user-id': Taro.getStorageSync('userId') || '' },
    }),

  updateCircle: (id: string, data: { name?: string; description?: string; icon?: string; coverUrl?: string }) =>
    request({
      url: `/circles/${id}`,
      method: 'PATCH',
      data,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  joinCircle: (circleId: string) =>
    request({
      url: `/circles/${circleId}/join`,
      method: 'POST',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  leaveCircle: (circleId: string) =>
    request({
      url: `/circles/${circleId}/join`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  getCirclePosts: (circleId: string, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({ url: `/circles/${circleId}/posts${query}` });
  },

  getCircleMembers: (circleId: string, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({ url: `/circles/${circleId}/members${query}` });
  },

  getMyCircles: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({
      url: `/my/circles${query}`,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    });
  },

  // 活动相册相关
  uploadActivityPhoto: (activityId: string, data: { url: string; description?: string }) =>
    request({
      url: `/activities/${activityId}/photos`,
      method: 'POST',
      data,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  getActivityPhotos: (activityId: string, params?: { cursor?: string; limit?: number; featuredOnly?: boolean }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/activities/${activityId}/photos${query}` });
  },

  deleteActivityPhoto: (photoId: string) =>
    request({
      url: `/photos/${photoId}`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  featureActivityPhoto: (photoId: string, featured: boolean) =>
    request({
      url: `/photos/${photoId}/feature`,
      method: 'PATCH',
      data: { featured },
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  getAlbumStats: (activityId: string) =>
    request({ url: `/activities/${activityId}/album-stats` }),

  // 用户资料与统计
  getUserProfile: (userId: string) =>
    request({
      url: `/users/${userId}/profile`,
      header: { 'x-user-id': Taro.getStorageSync('userId') || '' },
    }),

  getUserStats: (userId: string) =>
    request({ url: `/users/${userId}/stats` }),

  getUserPosts: (userId: string, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request({ url: `/users/${userId}/posts${query}` });
  },

  getUserBadges: (userId: string) =>
    request({ url: `/users/${userId}/badges` }),

  // ==================== Phase 3.3: 成就与通知 ====================

  // 通知相关
  getNotifications: (params?: { cursor?: string; limit?: number; unreadOnly?: boolean }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({
      url: `/notifications${query}`,
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    });
  },

  getUnreadCount: () =>
    request({
      url: '/notifications/unread-count',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  markNotificationAsRead: (notificationId: string) =>
    request({
      url: `/notifications/${notificationId}/read`,
      method: 'PATCH',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  markAllNotificationsAsRead: () =>
    request({
      url: '/notifications/read-all',
      method: 'PATCH',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  deleteNotification: (notificationId: string) =>
    request({
      url: `/notifications/${notificationId}`,
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  clearReadNotifications: () =>
    request({
      url: '/notifications/clear-read',
      method: 'DELETE',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  // 勋章相关
  getBadges: (category?: string) => {
    const query = category ? `?category=${category}` : '';
    return request({ url: `/badges${query}` });
  },

  getBadgeWall: () =>
    request({
      url: '/badges/wall',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  checkAchievements: () =>
    request({
      url: '/achievements/check',
      method: 'POST',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  // 排行榜相关
  getRouteContributors: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request({ url: `/leaderboard/contributors${query}` });
  },

  getActiveUsers: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request({ url: `/leaderboard/active${query}` });
  },

  getDistanceLeaders: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request({ url: `/leaderboard/distance${query}` });
  },

  getElevationLeaders: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request({ url: `/leaderboard/elevation${query}` });
  },

  getBadgeLeaders: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request({ url: `/leaderboard/badges${query}` });
  },

  getMyRankings: () =>
    request({
      url: '/leaderboard/my-rankings',
      header: { 'x-user-id': Taro.getStorageSync('userId') },
    }),

  // ==================== Phase 4: 订单与支付 ====================

  // 订单相关
  createOrder: (data: {
    enrollmentId: string;
    insuredName: string;
    insuredPhone: string;
    insuredIdCard?: string;
  }) =>
    request({
      url: '/orders',
      method: 'POST',
      data,
    }),

  getOrders: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/orders${query}` });
  },

  getOrderDetail: (orderId: string) =>
    request({ url: `/orders/${orderId}` }),

  cancelOrder: (orderId: string) =>
    request({
      url: `/orders/${orderId}/cancel`,
      method: 'POST',
    }),

  getVerifyCode: (orderId: string) =>
    request({ url: `/orders/${orderId}/verify-code` }),

  // 支付相关
  prepay: (data: { orderId: string; openId: string }) =>
    request({
      url: '/payments/prepay',
      method: 'POST',
      data,
    }),

  getPaymentStatus: (orderId: string) =>
    request({ url: `/payments/${orderId}/status` }),

  syncPaymentStatus: (orderId: string) =>
    request({
      url: `/payments/${orderId}/sync`,
      method: 'POST',
    }),

  // 模拟支付成功 (仅开发环境 H5 测试用)
  mockPaymentSuccess: (orderId: string) =>
    request({
      url: `/payments/${orderId}/mock-success`,
      method: 'POST',
    }),

  // 退款相关
  previewRefund: (orderId: string) =>
    request({ url: `/refunds/preview?orderId=${orderId}` }),

  createRefund: (data: { orderId: string; reason: string; reasonDetail?: string }) =>
    request({
      url: '/refunds',
      method: 'POST',
      data,
    }),

  getRefunds: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/refunds${query}` });
  },

  getRefundDetail: (refundId: string) =>
    request({ url: `/refunds/${refundId}` }),

  // 保险相关
  getInsuranceProducts: () =>
    request({ url: '/insurances/products' }),

  getMyInsurances: () =>
    request({ url: '/insurances/my' }),

  getInsuranceDetail: (insuranceId: string) =>
    request({ url: `/insurances/${insuranceId}` }),

  // 核销相关 (领队端)
  verifyOrder: (code: string) =>
    request({
      url: '/verifications/verify',
      method: 'POST',
      data: { code },
    }),

  verifyByOrderNo: (orderNo: string) =>
    request({
      url: `/verifications/verify-by-order-no/${orderNo}`,
      method: 'POST',
    }),

  getPendingVerificationActivities: () =>
    request({ url: '/verifications/pending-activities' }),

  getActivityVerificationStats: (activityId: string) =>
    request({ url: `/verifications/activities/${activityId}/stats` }),

  getActivityVerifications: (activityId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return request({ url: `/verifications/activities/${activityId}${query}` });
  },

  // ==================== Phase 4.3: 财务与管理 ====================

  // Dashboard
  getClubDashboard: (clubId: string) =>
    request({ url: `/finance/clubs/${clubId}/dashboard` }),

  getIncomeTrend: (clubId: string, days?: number) => {
    const query = days ? `?days=${days}` : '';
    return request({ url: `/finance/clubs/${clubId}/dashboard/income-trend${query}` });
  },

  getActivityRanking: (clubId: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request({ url: `/finance/clubs/${clubId}/dashboard/activity-ranking${query}` });
  },

  // 账户管理
  getClubAccount: (clubId: string) =>
    request({ url: `/finance/clubs/${clubId}/account` }),

  updateBankAccount: (clubId: string, data: { bankName: string; bankAccount: string; accountName: string }) =>
    request({
      url: `/finance/clubs/${clubId}/account/bank`,
      method: 'PUT',
      data,
    }),

  // 流水查询
  getTransactions: (clubId: string, params?: {
    activityId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/finance/clubs/${clubId}/transactions${query}` });
  },

  getMonthlyStats: (clubId: string, year: number, month: number) =>
    request({ url: `/finance/clubs/${clubId}/transactions/monthly?year=${year}&month=${month}` }),

  getFinanceReport: (clubId: string, startDate: string, endDate: string) =>
    request({ url: `/finance/clubs/${clubId}/transactions/report?startDate=${startDate}&endDate=${endDate}` }),

  // 提现管理
  createWithdrawal: (clubId: string, amount: number) =>
    request({
      url: `/finance/clubs/${clubId}/withdrawals`,
      method: 'POST',
      data: { amount },
    }),

  getWithdrawals: (clubId: string, params?: { status?: string; page?: number; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/finance/clubs/${clubId}/withdrawals${query}` });
  },

  getWithdrawalDetail: (clubId: string, withdrawalId: string) =>
    request({ url: `/finance/clubs/${clubId}/withdrawals/${withdrawalId}` }),

  // 结算管理
  getSettlements: (clubId: string, params?: {
    activityId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request({ url: `/finance/clubs/${clubId}/settlements${query}` });
  },

  getSettlementDetail: (clubId: string, settlementId: string) =>
    request({ url: `/finance/clubs/${clubId}/settlements/${settlementId}` }),

  getPendingSettlementStats: (clubId: string) =>
    request({ url: `/finance/clubs/${clubId}/settlements/pending/stats` }),
};

export default api;
