import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { PrismaService } from '../prisma.service';
import { ContentSecurityService } from '../common/content-security';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('PostService', () => {
  let service: PostService;
  let prisma: PrismaService;
  let contentSecurity: ContentSecurityService;
  let eventEmitter: EventEmitter2;

  const mockPrisma = {
    post: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    postLike: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    circle: {
      update: jest.fn(),
    },
  };

  const mockContentSecurity = {
    validateContent: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ContentSecurityService, useValue: mockContentSecurity },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    prisma = module.get<PrismaService>(PrismaService);
    contentSecurity = module.get<ContentSecurityService>(ContentSecurityService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const userId = 'user-123';
      const dto = {
        content: '今天去爬山了！',
        imageUrls: ['https://example.com/img1.jpg'],
        tags: ['徒步', '户外'],
      };

      const mockPost = {
        id: 'post-123',
        userId,
        content: dto.content,
        tags: dto.tags,
        images: [{ url: dto.imageUrls[0] }],
        user: { id: userId, nickname: 'User', avatarUrl: null },
        _count: { likes: 0, comments: 0 },
      };

      mockContentSecurity.validateContent.mockResolvedValue(undefined);
      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await service.createPost(userId, dto);

      expect(mockContentSecurity.validateContent).toHaveBeenCalledWith(dto.content);
      expect(mockPrisma.post.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('post.created', {
        userId,
        postId: mockPost.id,
      });
      expect(result.id).toBe('post-123');
    });

    it('should throw error for sensitive content', async () => {
      const userId = 'user-123';
      const dto = { content: '包含敏感词的内容' };

      mockContentSecurity.validateContent.mockRejectedValue(
        new Error('内容包含违规信息'),
      );

      await expect(service.createPost(userId, dto)).rejects.toThrow();
    });
  });

  describe('getPostById', () => {
    it('should return post with details', async () => {
      const postId = 'post-123';
      const mockPost = {
        id: postId,
        content: 'Test post',
        user: { id: 'user-1', nickname: 'User' },
        images: [],
        _count: { likes: 5, comments: 2 },
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);
      mockPrisma.post.update.mockResolvedValue(mockPost);

      const result = await service.getPostById(postId);

      expect(result.id).toBe(postId);
      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException for non-existent post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      await expect(service.getPostById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletePost', () => {
    it('should delete own post', async () => {
      const userId = 'user-123';
      const postId = 'post-123';

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        userId,
        images: [{ url: 'https://example.com/img.jpg' }],
        circleId: null,
      });
      mockPrisma.post.delete.mockResolvedValue({});

      const result = await service.deletePost(userId, postId);

      expect(result.success).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('oss.cleanup', {
        urls: ['https://example.com/img.jpg'],
      });
    });

    it('should throw ForbiddenException when deleting others post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-123',
        userId: 'other-user',
        images: [],
      });

      await expect(service.deletePost('user-123', 'post-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('likePost', () => {
    it('should like a post', async () => {
      const userId = 'user-123';
      const postId = 'post-456';

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        userId: 'other-user',
      });
      mockPrisma.postLike.upsert.mockResolvedValue({});

      const result = await service.likePost(userId, postId);

      expect(result.success).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.create', {
        userId: 'other-user',
        type: 'LIKE',
        title: '有人赞了你的动态',
        targetId: postId,
        targetType: 'Post',
      });
    });

    it('should not notify when liking own post', async () => {
      const userId = 'user-123';
      const postId = 'post-456';

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        userId, // 自己的帖子
      });
      mockPrisma.postLike.upsert.mockResolvedValue({});

      await service.likePost(userId, postId);

      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'notification.create',
        expect.anything(),
      );
    });
  });

  describe('batchCheckLiked', () => {
    it('should return correct like status for multiple posts', async () => {
      const userId = 'user-123';
      const postIds = ['post-1', 'post-2', 'post-3'];

      mockPrisma.postLike.findMany.mockResolvedValue([
        { postId: 'post-1' },
        { postId: 'post-3' },
      ]);

      const result = await service.batchCheckLiked(userId, postIds);

      expect(result).toEqual({
        'post-1': true,
        'post-2': false,
        'post-3': true,
      });
    });
  });
});
