import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationPage from './index';
import api from '../../services/request';
import Taro from '@tarojs/taro';

// Mock api
jest.mock('../../services/request', () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn(),
    markNotificationAsRead: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
  },
}));

// Mock Taro
jest.mock('@tarojs/taro', () => {
  const React = require('react');
  const taro = {
    useDidShow: (callback: any) => React.useEffect(callback, []),
    navigateTo: jest.fn(),
    showToast: jest.fn(),
    getStorageSync: jest.fn(),
  };
  return {
    __esModule: true,
    default: taro,
    ...taro,
  };
});

// Mock Taro components
jest.mock('@tarojs/components', () => {
  const React = require('react');
  return {
    View: ({ children, className, onClick, style }: any) => (
      <div className={className} onClick={onClick} style={style}>
        {children}
      </div>
    ),
    Text: ({ children, className }: any) => <span className={className}>{children}</span>,
    ScrollView: ({ children, className, onScrollToLower }: any) => (
      <div className={className} onScroll={onScrollToLower}>
        {children}
      </div>
    ),
  };
});

describe('NotificationPage', () => {
  const mockNotifications = [
    {
      id: '1',
      type: 'SYSTEM',
      title: 'Welcome',
      content: 'Welcome to FengZhui',
      targetId: null,
      targetType: null,
      isRead: false,
      createdAt: '2023-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      type: 'LIKE',
      title: 'New Like',
      content: null,
      targetId: 'post1',
      targetType: 'post',
      isRead: true,
      createdAt: '2023-01-02T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.getNotifications as jest.Mock).mockResolvedValue({
      notifications: mockNotifications,
      nextCursor: null,
      hasMore: false,
    });
  });

  it('renders notifications list', async () => {
    const { getByText, queryByText } = render(<NotificationPage />);

    await waitFor(() => {
      expect(queryByText('加载中...')).not.toBeInTheDocument();
    });

    expect(getByText('Welcome')).toBeInTheDocument();
    expect(getByText('Welcome to FengZhui')).toBeInTheDocument();
    expect(getByText('New Like')).toBeInTheDocument();
    expect(getByText('未读 1 条')).toBeInTheDocument();
  });

  it('marks notification as read on click', async () => {
    const { getByText } = render(<NotificationPage />);

    await waitFor(() => {
      expect(getByText('Welcome')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Welcome'));

    expect(api.markNotificationAsRead).toHaveBeenCalledWith('1');
  });

  it('navigates to target on click', async () => {
    const { getByText } = render(<NotificationPage />);

    await waitFor(() => {
      expect(getByText('New Like')).toBeInTheDocument();
    });

    fireEvent.click(getByText('New Like'));

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/post/detail?id=post1' });
  });

  it('marks all as read', async () => {
    const { getByText } = render(<NotificationPage />);

    await waitFor(() => {
      expect(getByText('全部已读')).toBeInTheDocument();
    });

    fireEvent.click(getByText('全部已读'));

    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
  });
});
