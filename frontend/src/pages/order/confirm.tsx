import { useState, useEffect, useCallback } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Image, Input } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import api from '../../services/request';
import './confirm.scss';

interface ActivityInfo {
  id: string;
  title: string;
  coverUrl: string;
  startTime: string;
  endTime: string;
  price: number;
  club: {
    name: string;
    logo: string;
  };
  insuranceProduct?: {
    id: string;
    name: string;
    price: number;
    provider: string;
  };
}

interface EnrollmentInfo {
  id: string;
  amount: number;
  contactName: string;
  contactPhone: string;
}

export default function OrderConfirm() {
  const router = useRouter();
  const { enrollmentId } = router.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null);
  const [countdown, setCountdown] = useState(15 * 60); // 15分钟倒计时

  // 投保人信息
  const [insuredName, setInsuredName] = useState('');
  const [insuredPhone, setInsuredPhone] = useState('');
  const [insuredIdCard, setInsuredIdCard] = useState('');

  // 加载报名和活动信息
  useEffect(() => {
    if (!enrollmentId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    const loadData = async () => {
      try {
        // 获取报名详情（包含活动信息）
        const userId = Taro.getStorageSync('userId');
        const enrollments = await api.getUserEnrollments(userId);
        const enrollmentData = enrollments.find((e: any) => e.id === enrollmentId);

        if (!enrollmentData) {
          Taro.showToast({ title: '报名记录不存在', icon: 'none' });
          setTimeout(() => Taro.navigateBack(), 1500);
          return;
        }

        setEnrollment({
          id: enrollmentData.id,
          amount: enrollmentData.amount,
          contactName: enrollmentData.contactName,
          contactPhone: enrollmentData.contactPhone,
        });

        // 默认使用报名时的联系人信息
        setInsuredName(enrollmentData.contactName || '');
        setInsuredPhone(enrollmentData.contactPhone || '');

        // 获取活动详情
        const activityData = await api.getActivityDetail(enrollmentData.activityId);
        setActivity(activityData);
      } catch (error) {
        console.error('加载数据失败:', error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [enrollmentId]);

  // 倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          Taro.showModal({
            title: '支付超时',
            content: '订单已超时，请重新报名',
            showCancel: false,
            success: () => Taro.navigateBack(),
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 格式化倒计时
  const formatCountdown = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 计算保险费用
  const calculateInsuranceFee = () => {
    if (!activity?.insuranceProduct || !activity.startTime || !activity.endTime) {
      return 0;
    }
    const days = Math.ceil(
      (new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return activity.insuranceProduct.price * Math.max(1, days);
  };

  // 提交订单
  const handleSubmit = async () => {
    // 验证表单
    if (!insuredName.trim()) {
      Taro.showToast({ title: '请填写被保险人姓名', icon: 'none' });
      return;
    }
    if (!insuredPhone.trim() || !/^1[3-9]\d{9}$/.test(insuredPhone)) {
      Taro.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      // 1. 创建订单
      const order = await api.createOrder({
        enrollmentId: enrollmentId!,
        insuredName: insuredName.trim(),
        insuredPhone: insuredPhone.trim(),
        insuredIdCard: insuredIdCard.trim() || undefined,
      });

      // 2. 获取 openId (微信小程序环境)
      let openId = Taro.getStorageSync('openId');
      if (!openId && process.env.TARO_ENV === 'weapp') {
        const loginRes = await Taro.login();
        // 实际需要调用后端接口换取 openId
        openId = loginRes.code; // 临时使用 code
      }

      // 3. 发起预支付
      const payParams = await api.prepay({
        orderId: order.id,
        openId: openId || 'mock_openid',
      });

      // 4. 调起微信支付
      if (process.env.TARO_ENV === 'weapp') {
        await Taro.requestPayment({
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType as 'RSA',
          paySign: payParams.paySign,
        });

        // 支付成功，跳转结果页
        Taro.redirectTo({
          url: `/pages/order/result?orderId=${order.id}&status=success`,
        });
      } else {
        // H5 环境模拟支付成功
        Taro.showModal({
          title: '开发环境',
          content: '模拟支付成功',
          showCancel: false,
          success: () => {
            Taro.redirectTo({
              url: `/pages/order/result?orderId=${order.id}&status=success`,
            });
          },
        });
      }
    } catch (error: any) {
      console.error('支付失败:', error);
      if (error.errMsg?.includes('cancel')) {
        Taro.showToast({ title: '已取消支付', icon: 'none' });
      } else {
        Taro.showToast({ title: error.message || '支付失败', icon: 'none' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="order-confirm loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!activity || !enrollment) {
    return (
      <View className="order-confirm error">
        <Text>数据加载失败</Text>
      </View>
    );
  }

  const insuranceFee = calculateInsuranceFee();
  const totalAmount = enrollment.amount + insuranceFee;

  return (
    <View className="order-confirm">
      {/* 倒计时提示 */}
      <View className="countdown-bar">
        <Text className="countdown-text">
          请在 <Text className="countdown-time">{formatCountdown(countdown)}</Text> 内完成支付
        </Text>
      </View>

      {/* 活动信息 */}
      <View className="section activity-info">
        <View className="activity-card">
          <Image className="cover" src={activity.coverUrl} mode="aspectFill" />
          <View className="info">
            <Text className="title">{activity.title}</Text>
            <Text className="date">
              {formatDate(activity.startTime)} - {formatDate(activity.endTime)}
            </Text>
            <View className="club">
              <Image className="club-logo" src={activity.club.logo} />
              <Text className="club-name">{activity.club.name}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 保险信息 */}
      {activity.insuranceProduct && (
        <View className="section insurance-info">
          <View className="section-title">
            <Text>保险信息</Text>
            <Text className="required">必选</Text>
          </View>
          <View className="insurance-card">
            <View className="insurance-header">
              <Text className="name">{activity.insuranceProduct.name}</Text>
              <Text className="provider">{activity.insuranceProduct.provider}</Text>
            </View>
            <View className="insurance-detail">
              <Text className="price">¥{insuranceFee.toFixed(2)}</Text>
              <Text className="desc">
                保障期间: {formatDate(activity.startTime)} - {formatDate(activity.endTime)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 被保险人信息 */}
      <View className="section insured-info">
        <View className="section-title">
          <Text>被保险人信息</Text>
        </View>
        <View className="form-item">
          <Text className="label">姓名</Text>
          <Input
            className="input"
            placeholder="请填写真实姓名"
            value={insuredName}
            onInput={(e) => setInsuredName(e.detail.value)}
          />
        </View>
        <View className="form-item">
          <Text className="label">手机号</Text>
          <Input
            className="input"
            type="number"
            placeholder="请填写手机号"
            maxlength={11}
            value={insuredPhone}
            onInput={(e) => setInsuredPhone(e.detail.value)}
          />
        </View>
        <View className="form-item">
          <Text className="label">身份证</Text>
          <Input
            className="input"
            placeholder="选填，用于快速理赔"
            maxlength={18}
            value={insuredIdCard}
            onInput={(e) => setInsuredIdCard(e.detail.value)}
          />
        </View>
      </View>

      {/* 费用明细 */}
      <View className="section fee-detail">
        <View className="section-title">
          <Text>费用明细</Text>
        </View>
        <View className="fee-item">
          <Text className="label">活动费用</Text>
          <Text className="value">¥{enrollment.amount.toFixed(2)}</Text>
        </View>
        {insuranceFee > 0 && (
          <View className="fee-item">
            <Text className="label">保险费用</Text>
            <Text className="value">¥{insuranceFee.toFixed(2)}</Text>
          </View>
        )}
        <View className="fee-item total">
          <Text className="label">合计</Text>
          <Text className="value">¥{totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      {/* 底部支付栏 */}
      <View className="bottom-bar">
        <View className="price-info">
          <Text className="label">应付金额</Text>
          <Text className="price">¥{totalAmount.toFixed(2)}</Text>
        </View>
        <Button
          type="primary"
          className="pay-btn"
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          确认支付
        </Button>
      </View>
    </View>
  );
}
