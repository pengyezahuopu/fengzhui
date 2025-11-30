import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Input, Button, Cell, Loading } from '@nutui/nutui-react-taro';
import { api } from '../../../services/request';
import './index.scss';

interface AccountInfo {
  balance: number;
  frozenBalance: number;
  availableBalance: number;
  hasBankAccount: boolean;
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountName: string;
  } | null;
}

export default function Withdrawal() {
  const router = useRouter();
  const { clubId } = router.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (clubId) {
      loadAccount();
    }
  }, [clubId]);

  const loadAccount = async () => {
    try {
      setLoading(true);
      const result = await api.getClubAccount(clubId!);
      setAccount(result);

      if (!result.hasBankAccount) {
        Taro.showToast({ title: '请先设置提现账户', icon: 'none' });
        setTimeout(() => {
          Taro.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('加载账户信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (value: number) => {
    return `¥${value.toFixed(2)}`;
  };

  const handleAmountChange = (val: string) => {
    // 只允许输入数字和小数点
    const cleaned = val.replace(/[^\d.]/g, '');
    // 限制小数点后两位
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handleWithdrawAll = () => {
    if (account) {
      setAmount(account.availableBalance.toFixed(2));
    }
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);

    if (!amount || isNaN(amountNum)) {
      Taro.showToast({ title: '请输入提现金额', icon: 'none' });
      return;
    }

    if (amountNum < 100) {
      Taro.showToast({ title: '最低提现金额为100元', icon: 'none' });
      return;
    }

    if (account && amountNum > account.availableBalance) {
      Taro.showToast({ title: '提现金额超过可用余额', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      const result = await api.createWithdrawal(clubId!, amountNum);
      Taro.showToast({ title: '提现申请已提交', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('提现申请失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="withdrawal-loading">
        <Loading type="spinner" />
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!account?.hasBankAccount) {
    return (
      <View className="withdrawal-empty">
        <Text>请先设置提现账户</Text>
      </View>
    );
  }

  const amountNum = parseFloat(amount) || 0;
  const isValid = amountNum >= 100 && amountNum <= (account?.availableBalance || 0);

  return (
    <View className="withdrawal-page">
      {/* 账户信息 */}
      <View className="account-info">
        <View className="balance-row">
          <Text className="label">可提现余额</Text>
          <Text className="value">{formatAmount(account?.availableBalance || 0)}</Text>
        </View>
        <View className="bank-row">
          <Text className="bank">{account?.bankInfo?.bankName}</Text>
          <Text className="card">{account?.bankInfo?.bankAccount}</Text>
        </View>
      </View>

      {/* 提现金额 */}
      <View className="amount-section">
        <View className="section-title">
          <Text>提现金额</Text>
          <Text className="all-btn" onClick={handleWithdrawAll}>全部提现</Text>
        </View>
        <View className="amount-input-wrap">
          <Text className="currency">¥</Text>
          <Input
            className="amount-input"
            type="digit"
            placeholder="请输入提现金额"
            value={amount}
            onChange={handleAmountChange}
          />
        </View>
        <View className="amount-tips">
          <Text className="tip">最低提现金额: ¥100.00</Text>
        </View>
      </View>

      {/* 提现说明 */}
      <View className="notice-section">
        <View className="notice-title">提现说明</View>
        <View className="notice-list">
          <View className="notice-item">
            <Text>1. 提现申请提交后，将在1-3个工作日内审核处理</Text>
          </View>
          <View className="notice-item">
            <Text>2. 审核通过后，款项将在1-3个工作日内到达您的银行账户</Text>
          </View>
          <View className="notice-item">
            <Text>3. 提现过程中如有问题，请联系客服</Text>
          </View>
        </View>
      </View>

      {/* 提交按钮 */}
      <View className="submit-section">
        <Button
          block
          type="primary"
          disabled={!isValid || submitting}
          loading={submitting}
          onClick={handleSubmit}
        >
          {submitting ? '提交中...' : `确认提现 ${amount ? formatAmount(amountNum) : ''}`}
        </Button>
      </View>
    </View>
  );
}
