import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BadgeWall from './BadgeWall';
import api from '../../services/request';

// Mock api
jest.mock('../../services/request', () => ({
  __esModule: true,
  default: {
    getBadgeWall: jest.fn(),
    getUserBadges: jest.fn(),
  },
}));

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  getStorageSync: jest.fn(),
}));

// Mock Taro components
jest.mock('@tarojs/components', () => {
  const React = require('react');
  return {
    View: ({ children, className, onClick }: any) => (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    ),
    Text: ({ children, className }: any) => <span className={className}>{children}</span>,
    Image: ({ src, className }: any) => <img src={src} className={className} alt="" />,
  };
});

describe('BadgeWall', () => {
  const mockBadges = [
    {
      id: '1',
      name: 'First Hike',
      icon: '🥾',
      description: 'First Hike Description',
      category: 'MILESTONE',
      earned: true,
      earnedAt: '2023-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      name: 'Social Star',
      icon: '💬',
      description: 'Social Star Description',
      category: 'SOCIAL',
      earned: false,
      earnedAt: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (api.getBadgeWall as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { getByText } = render(<BadgeWall />);
    expect(getByText('加载中...')).toBeInTheDocument();
  });

  it('renders badges after loading', async () => {
    (api.getBadgeWall as jest.Mock).mockResolvedValue(mockBadges);

    const { getByText, queryByText } = render(<BadgeWall />);

    await waitFor(() => {
      expect(queryByText('加载中...')).not.toBeInTheDocument();
    });

    expect(getByText('First Hike')).toBeInTheDocument();
    expect(getByText('Social Star')).toBeInTheDocument();
    expect(getByText('已获得 1/2 枚勋章')).toBeInTheDocument();
  });

  it('shows badge detail on click', async () => {
    (api.getBadgeWall as jest.Mock).mockResolvedValue(mockBadges);

    const { getByText, queryByText } = render(<BadgeWall />);

    await waitFor(() => {
      expect(queryByText('加载中...')).not.toBeInTheDocument();
    });

    fireEvent.click(getByText('First Hike'));

    expect(getByText('First Hike Description')).toBeInTheDocument();
    expect(getByText('获得时间: 1/1/2023')).toBeInTheDocument(); // Date formatting might vary depending on locale
  });

  it('loads user badges when userId is provided', async () => {
    (api.getUserBadges as jest.Mock).mockResolvedValue(mockBadges);

    render(<BadgeWall userId="user123" />);

    await waitFor(() => {
      expect(api.getUserBadges).toHaveBeenCalledWith('user123');
    });
  });
});
