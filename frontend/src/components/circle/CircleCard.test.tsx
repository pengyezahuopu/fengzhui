import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CircleCard from './CircleCard';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  navigateTo: jest.fn(),
}));

describe('CircleCard Component', () => {
  const mockCircle = {
    id: 'circle-1',
    name: 'Test Circle',
    description: 'This is a test circle',
    icon: 'http://icon.com',
    memberCount: 100,
    postCount: 50,
  };

  it('should render circle info', () => {
    render(<CircleCard circle={mockCircle} />);
    expect(screen.getByText('Test Circle')).toBeInTheDocument();
    expect(screen.getByText('This is a test circle')).toBeInTheDocument();
  });

  it('should render stats', () => {
    render(<CircleCard circle={mockCircle} />);
    expect(screen.getByText('100成员')).toBeInTheDocument();
    expect(screen.getByText('50动态')).toBeInTheDocument();
  });
});
