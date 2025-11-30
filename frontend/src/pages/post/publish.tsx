import { View, Text, Textarea, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import api from '../../services/request';
import './publish.scss';

const MAX_IMAGES = 9;
const MAX_CONTENT_LENGTH = 500;

export default function PostPublish() {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 选择图片
  const chooseImages = async () => {
    const remainCount = MAX_IMAGES - images.length;
    if (remainCount <= 0) {
      Taro.showToast({ title: `最多上传${MAX_IMAGES}张图片`, icon: 'none' });
      return;
    }

    try {
      const result = await Taro.chooseImage({
        count: remainCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      // TODO: 上传图片到 OSS，获取 URL
      // 目前使用本地路径作为临时方案
      setImages((prev) => [...prev, ...result.tempFilePaths]);
    } catch (error) {
      console.error('Choose image failed:', error);
    }
  };

  // 删除图片
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 预览图片
  const previewImage = (url: string) => {
    Taro.previewImage({
      current: url,
      urls: images,
    });
  };

  // 提交帖子
  const handleSubmit = async () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      // TODO: 先上传图片到 OSS，获取 URL 列表
      const imageUrls = images; // 临时使用本地路径

      await api.createPost({
        content: content.trim(),
        images: imageUrls.length > 0 ? imageUrls : undefined,
      });

      Taro.showToast({ title: '发布成功', icon: 'success' });

      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('Publish failed:', error);
      Taro.showToast({ title: '发布失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = content.trim().length > 0 && !submitting;

  return (
    <View className="publish-page">
      {/* 顶部导航栏 */}
      <View className="nav-bar">
        <Text className="nav-cancel" onClick={() => Taro.navigateBack()}>
          取消
        </Text>
        <Text className="nav-title">发布动态</Text>
        <View
          className={`nav-submit ${canSubmit ? 'active' : ''}`}
          onClick={canSubmit ? handleSubmit : undefined}
        >
          <Text className="submit-text">{submitting ? '发布中...' : '发布'}</Text>
        </View>
      </View>

      {/* 内容输入区 */}
      <View className="content-area">
        <Textarea
          className="content-input"
          placeholder="分享你的户外经历..."
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={MAX_CONTENT_LENGTH}
          autoHeight
          showConfirmBar={false}
        />
        <Text className="content-count">
          {content.length}/{MAX_CONTENT_LENGTH}
        </Text>
      </View>

      {/* 图片选择区 */}
      <View className="image-area">
        <View className="image-grid">
          {images.map((img, index) => (
            <View key={index} className="image-item">
              <Image
                className="preview-image"
                src={img}
                mode="aspectFill"
                onClick={() => previewImage(img)}
              />
              <View className="remove-btn" onClick={() => removeImage(index)}>
                <Text className="remove-icon">×</Text>
              </View>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <View className="add-image" onClick={chooseImages}>
              <Text className="add-icon">+</Text>
              <Text className="add-text">添加图片</Text>
            </View>
          )}
        </View>
      </View>

      {/* 功能入口（可扩展） */}
      <View className="feature-area">
        <View className="feature-item">
          <Text className="feature-icon">📍</Text>
          <Text className="feature-text">添加位置</Text>
        </View>
        <View className="feature-item">
          <Text className="feature-icon">🏔️</Text>
          <Text className="feature-text">关联路线</Text>
        </View>
        <View className="feature-item">
          <Text className="feature-icon">🎯</Text>
          <Text className="feature-text">关联活动</Text>
        </View>
      </View>
    </View>
  );
}
