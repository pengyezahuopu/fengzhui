import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Image, Canvas } from '@tarojs/components';
import api from '../../services/request';
import './qrcode.scss';

interface OrderInfo {
  id: string;
  orderNo: string;
  verifyCode: string;
  activity: {
    title: string;
    startTime: string;
    endTime: string;
  };
}

export default function OrderQRCode() {
  const router = useRouter();
  const { orderId } = router.params;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [verifyCode, setVerifyCode] = useState<string>('');

  useEffect(() => {
    if (!orderId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    const loadData = async () => {
      try {
        // 获取订单详情
        const orderData = await api.getOrderDetail(orderId);
        setOrder(orderData);

        // 获取核销码
        const codeResult = await api.getVerifyCode(orderId);
        setVerifyCode(codeResult.verifyCode);

        // 生成二维码
        setTimeout(() => generateQRCode(codeResult.verifyCode), 100);
      } catch (error) {
        console.error('加载失败:', error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId]);

  const generateQRCode = (code: string) => {
    // 简单的二维码生成（实际项目中应使用专门的二维码库如 qrcode）
    // 这里使用占位实现，实际需要引入二维码生成库
    const ctx = Taro.createCanvasContext('qrcode', null);

    // 绘制背景
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, 200, 200);

    // 绘制简单的占位图案（实际应该是真正的二维码）
    ctx.setFillStyle('#333333');
    ctx.setFontSize(12);
    ctx.setTextAlign('center');
    ctx.fillText('核销码', 100, 90);
    ctx.setFontSize(10);
    ctx.fillText(code.substring(0, 20) + '...', 100, 110);

    ctx.draw();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const handleSaveImage = async () => {
    try {
      // 将 canvas 转为图片并保存
      const res = await Taro.canvasToTempFilePath({
        canvasId: 'qrcode',
      });

      await Taro.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
      });

      Taro.showToast({ title: '保存成功', icon: 'success' });
    } catch (error: any) {
      if (error.errMsg?.includes('auth deny')) {
        Taro.showModal({
          title: '提示',
          content: '需要您授权保存图片到相册',
          confirmText: '去设置',
          success: (result) => {
            if (result.confirm) {
              Taro.openSetting();
            }
          },
        });
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      }
    }
  };

  if (loading) {
    return (
      <View className="order-qrcode loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="order-qrcode error">
        <Text>订单不存在</Text>
      </View>
    );
  }

  return (
    <View className="order-qrcode">
      <View className="card">
        <View className="card-header">
          <Text className="title">{order.activity.title}</Text>
          <Text className="date">
            活动时间: {formatDate(order.activity.startTime)} - {formatDate(order.activity.endTime)}
          </Text>
        </View>

        <View className="qrcode-wrapper">
          <Canvas
            canvasId="qrcode"
            className="qrcode-canvas"
            style={{ width: '200px', height: '200px' }}
          />
          <Text className="qrcode-tip">请在活动现场出示此码进行签到</Text>
        </View>

        <View className="code-info">
          <Text className="label">核销码</Text>
          <Text className="code">{verifyCode}</Text>
        </View>

        <View className="order-info">
          <Text className="order-no">订单号: {order.orderNo}</Text>
        </View>
      </View>

      <View className="tips">
        <View className="tip-title">
          <Image
            className="tip-icon"
            src="https://img.icons8.com/fluency/48/info.png"
          />
          <Text>使用说明</Text>
        </View>
        <View className="tip-list">
          <Text className="tip-item">1. 请在活动当天向工作人员出示此二维码</Text>
          <Text className="tip-item">2. 核销码仅限本人使用，请勿转让</Text>
          <Text className="tip-item">3. 核销码有效期为活动结束后7天内</Text>
          <Text className="tip-item">4. 如遇问题请联系活动组织方</Text>
        </View>
      </View>

      <View className="actions">
        <View className="action-btn" onClick={handleSaveImage}>
          <Image
            className="btn-icon"
            src="https://img.icons8.com/fluency/48/download.png"
          />
          <Text>保存到相册</Text>
        </View>
      </View>
    </View>
  );
}
