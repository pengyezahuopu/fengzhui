import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Tabs, Tag, Button, Empty, Loading, Popup, Input, Form } from '@nutui/nutui-react-taro';
import { api } from '../../../services/request';
import './index.scss';

interface AccountInfo {
  balance: number;
  frozenBalance: number;
  availableBalance: number;
  totalIncome: number;
  totalWithdraw: number;
  hasBankAccount: boolean;
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountName: string;
  } | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  activity?: { id: string; title: string };
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  withdrawalNo: string;
  amount: number;
  fee: number;
  actualAmount: number;
  status: string;
  rejectReason?: string;
  createdAt: string;
  reviewedAt?: string;
  transferredAt?: string;
}

interface Settlement {
  id: string;
  settlementNo: string;
  activity: { id: string; title: string };
  totalAmount: number;
  platformFee: number;
  refundAmount: number;
  settleAmount: number;
  status: string;
  settledAt?: string;
  createdAt: string;
}

const transactionTypeMap: Record<string, { text: string; color: string }> = {
  INCOME: { text: '收入', color: '#52c41a' },
  REFUND: { text: '退款', color: '#ff4d4f' },
  WITHDRAWAL: { text: '提现', color: '#1890ff' },
  FEE: { text: '服务费', color: '#faad14' },
  SETTLEMENT: { text: '结算', color: '#52c41a' },
};

const withdrawalStatusMap: Record<string, { text: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'default' }> = {
  PENDING: { text: '审核中', type: 'warning' },
  APPROVED: { text: '已审批', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  REJECTED: { text: '已拒绝', type: 'danger' },
};

const settlementStatusMap: Record<string, { text: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'default' }> = {
  PENDING: { text: '待结算', type: 'warning' },
  COMPLETED: { text: '已结算', type: 'success' },
};

export default function FinanceCenter() {
  const router = useRouter();
  const { clubId } = router.params;

  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankAccount: '',
    accountName: '',
  });

  useDidShow(() => {
    if (clubId) {
      loadAccount();
    }
  });

  useEffect(() => {
    if (clubId) {
      loadTabData();
    }
  }, [tabIndex, clubId]);

  const loadAccount = async () => {
    try {
      const result = await api.getClubAccount(clubId!);
      setAccount(result);
      if (result.bankInfo) {
        setBankForm({
          bankName: result.bankInfo.bankName || '',
          bankAccount: '',
          accountName: result.bankInfo.accountName || '',
        });
      }
    } catch (error) {
      console.error('加载账户信息失败:', error);
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      switch (tabIndex) {
        case 0: // 流水
          const txResult = await api.getTransactions(clubId!);
          setTransactions(txResult.items || []);
          break;
        case 1: // 提现
          const wdResult = await api.getWithdrawals(clubId!);
          setWithdrawals(wdResult.items || []);
          break;
        case 2: // 结算
          const stResult = await api.getSettlements(clubId!);
          setSettlements(stResult.items || []);
          break;
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handleUpdateBankAccount = async () => {
    if (!bankForm.bankName || !bankForm.bankAccount || !bankForm.accountName) {
      Taro.showToast({ title: '请填写完整银行信息', icon: 'none' });
      return;
    }

    try {
      await api.updateBankAccount(clubId!, bankForm);
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setShowBankForm(false);
      loadAccount();
    } catch (error) {
      console.error('保存银行信息失败:', error);
    }
  };

  const handleWithdraw = () => {
    if (!account?.hasBankAccount) {
      setShowBankForm(true);
      return;
    }
    Taro.navigateTo({ url: `/pages/club/withdrawal/index?clubId=${clubId}` });
  };

  return (
    <View className="finance-center">
      {/* 账户概览 */}
      <View className="account-card">
        <View className="balance-row">
          <View className="balance-item">
            <Text className="label">可提现余额</Text>
            <Text className="value">{formatAmount(account?.availableBalance || 0)}</Text>
          </View>
          <Button type="primary" size="small" onClick={handleWithdraw}>
            提现
          </Button>
        </View>
        <View className="stats-row">
          <View className="stat">
            <Text className="value">{formatAmount(account?.totalIncome || 0)}</Text>
            <Text className="label">累计收入</Text>
          </View>
          <View className="stat">
            <Text className="value">{formatAmount(account?.totalWithdraw || 0)}</Text>
            <Text className="label">累计提现</Text>
          </View>
          <View className="stat">
            <Text className="value">{formatAmount(account?.frozenBalance || 0)}</Text>
            <Text className="label">冻结金额</Text>
          </View>
        </View>
        {account?.bankInfo ? (
          <View className="bank-info" onClick={() => setShowBankForm(true)}>
            <Text className="text">{account.bankInfo.bankName} {account.bankInfo.bankAccount}</Text>
            <Text className="action">修改</Text>
          </View>
        ) : (
          <View className="bank-info" onClick={() => setShowBankForm(true)}>
            <Text className="text">未设置提现账户</Text>
            <Text className="action">去设置</Text>
          </View>
        )}
      </View>

      {/* 标签页 */}
      <View className="tab-container">
        <Tabs value={tabIndex} onChange={(val) => setTabIndex(val as number)}>
          <Tabs.TabPane title="流水明细">
            {loading ? (
              <View className="tab-loading">
                <Loading type="spinner" />
              </View>
            ) : transactions.length > 0 ? (
              <ScrollView scrollY className="list-scroll">
                {transactions.map((tx) => (
                  <View key={tx.id} className="list-item transaction-item">
                    <View className="item-left">
                      <Text
                        className="type"
                        style={{ color: transactionTypeMap[tx.type]?.color || '#333' }}
                      >
                        {transactionTypeMap[tx.type]?.text || tx.type}
                      </Text>
                      <Text className="desc">{tx.description}</Text>
                      {tx.activity && (
                        <Text className="activity">关联活动: {tx.activity.title}</Text>
                      )}
                    </View>
                    <View className="item-right">
                      <Text className={`amount ${tx.amount >= 0 ? 'income' : 'expense'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatAmount(tx.amount)}
                      </Text>
                      <Text className="time">{formatDate(tx.createdAt)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Empty description="暂无流水记录" />
            )}
          </Tabs.TabPane>

          <Tabs.TabPane title="提现记录">
            {loading ? (
              <View className="tab-loading">
                <Loading type="spinner" />
              </View>
            ) : withdrawals.length > 0 ? (
              <ScrollView scrollY className="list-scroll">
                {withdrawals.map((wd) => (
                  <View key={wd.id} className="list-item withdrawal-item">
                    <View className="item-header">
                      <Text className="no">{wd.withdrawalNo}</Text>
                      <Tag type={withdrawalStatusMap[wd.status]?.type || 'default'}>
                        {withdrawalStatusMap[wd.status]?.text || wd.status}
                      </Tag>
                    </View>
                    <View className="item-body">
                      <View className="amount-row">
                        <Text className="label">提现金额</Text>
                        <Text className="value">{formatAmount(wd.amount)}</Text>
                      </View>
                      {wd.fee > 0 && (
                        <View className="amount-row">
                          <Text className="label">手续费</Text>
                          <Text className="value fee">-{formatAmount(wd.fee)}</Text>
                        </View>
                      )}
                      <View className="amount-row">
                        <Text className="label">实际到账</Text>
                        <Text className="value actual">{formatAmount(wd.actualAmount)}</Text>
                      </View>
                    </View>
                    {wd.rejectReason && (
                      <View className="reject-reason">
                        <Text className="label">拒绝原因:</Text>
                        <Text className="text">{wd.rejectReason}</Text>
                      </View>
                    )}
                    <View className="item-footer">
                      <Text className="time">申请时间: {formatDate(wd.createdAt)}</Text>
                      {wd.transferredAt && (
                        <Text className="time">到账时间: {formatDate(wd.transferredAt)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Empty description="暂无提现记录" />
            )}
          </Tabs.TabPane>

          <Tabs.TabPane title="结算记录">
            {loading ? (
              <View className="tab-loading">
                <Loading type="spinner" />
              </View>
            ) : settlements.length > 0 ? (
              <ScrollView scrollY className="list-scroll">
                {settlements.map((st) => (
                  <View key={st.id} className="list-item settlement-item">
                    <View className="item-header">
                      <Text className="no">{st.settlementNo}</Text>
                      <Tag type={settlementStatusMap[st.status]?.type || 'default'}>
                        {settlementStatusMap[st.status]?.text || st.status}
                      </Tag>
                    </View>
                    <View className="activity-name">
                      <Text>{st.activity.title}</Text>
                    </View>
                    <View className="item-body">
                      <View className="amount-row">
                        <Text className="label">订单总额</Text>
                        <Text className="value">{formatAmount(st.totalAmount)}</Text>
                      </View>
                      <View className="amount-row">
                        <Text className="label">退款金额</Text>
                        <Text className="value refund">-{formatAmount(st.refundAmount)}</Text>
                      </View>
                      <View className="amount-row">
                        <Text className="label">平台服务费(5%)</Text>
                        <Text className="value fee">-{formatAmount(st.platformFee)}</Text>
                      </View>
                      <View className="amount-row total">
                        <Text className="label">结算金额</Text>
                        <Text className="value">{formatAmount(st.settleAmount)}</Text>
                      </View>
                    </View>
                    <View className="item-footer">
                      <Text className="time">创建时间: {formatDate(st.createdAt)}</Text>
                      {st.settledAt && (
                        <Text className="time">结算时间: {formatDate(st.settledAt)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Empty description="暂无结算记录" />
            )}
          </Tabs.TabPane>
        </Tabs>
      </View>

      {/* 银行账户表单弹窗 */}
      <Popup
        visible={showBankForm}
        position="bottom"
        round
        closeable
        onClose={() => setShowBankForm(false)}
      >
        <View className="bank-form-popup">
          <View className="popup-title">设置提现账户</View>
          <View className="form-content">
            <View className="form-item">
              <Text className="label">开户银行</Text>
              <Input
                placeholder="请输入开户银行"
                value={bankForm.bankName}
                onChange={(val) => setBankForm({ ...bankForm, bankName: val })}
              />
            </View>
            <View className="form-item">
              <Text className="label">银行卡号</Text>
              <Input
                placeholder="请输入银行卡号"
                value={bankForm.bankAccount}
                onChange={(val) => setBankForm({ ...bankForm, bankAccount: val })}
              />
            </View>
            <View className="form-item">
              <Text className="label">开户人姓名</Text>
              <Input
                placeholder="请输入开户人姓名"
                value={bankForm.accountName}
                onChange={(val) => setBankForm({ ...bankForm, accountName: val })}
              />
            </View>
          </View>
          <View className="popup-actions">
            <Button block type="primary" onClick={handleUpdateBankAccount}>
              保存
            </Button>
          </View>
        </View>
      </Popup>
    </View>
  );
}
