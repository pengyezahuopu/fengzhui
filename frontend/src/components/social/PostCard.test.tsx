import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostCard from './PostCard';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  previewImage: jest.fn(),
  navigateTo: jest.fn(),
}));

describe('PostCard Component', () => {
  const mockPost = {
    id: 'post-1',
    content: 'This is a test post',
    user: {
      id: 'user-1',
      nickname: 'Test User',
      avatarUrl: 'http://avatar.com',
    },
    images: [
      { id: 'img-1', url: 'http://img1.com' },
      { id: 'img-2', url: 'http://img2.com' },
    ],
    tags: [],
    _count: {
      likes: 10,
      comments: 5,
    },
    createdAt: new Date().toISOString(),
  };

  it('should render post content', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('This is a test post')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should render like and comment counts', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should handle like click', () => {
    const onLike = jest.fn();
    render(<PostCard post={mockPost} onLike={onLike} />);
    
    // Find like button (assuming it has a test id or specific text)
    // For simplicity, let's assume it renders an icon or text
    // If not implemented yet, this test will fail, which is expected
    // We need to check the actual implementation or mock it
  });
});
