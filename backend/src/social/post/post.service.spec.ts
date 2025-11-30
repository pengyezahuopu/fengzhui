import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { PrismaService } from '../../prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  post: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  postLike: {
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('PostService', () => {
  let service: PostService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a post with images', async () => {
      const mockInput = {
        userId: 'user-1',
        content: 'Hello world',
        tags: ['test'],
        imageUrls: ['http://img1.com', 'http://img2.com'],
      };

      prisma.post.create.mockResolvedValue({
        id: 'post-1',
        ...mockInput,
        images: [{ url: 'http://img1.com' }, { url: 'http://img2.com' }],
      });

      const result = await service.createPost(mockInput);
      expect(result).toBeDefined();
      expect(prisma.post.create).toHaveBeenCalled();
    });
  });

  describe('likePost', () => {
    it('should like a post', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
      prisma.postLike.create.mockResolvedValue({ id: 'like-1' });

      await service.likePost('post-1', 'user-1');
      expect(prisma.postLike.create).toHaveBeenCalledWith({
        data: { postId: 'post-1', userId: 'user-1' },
      });
    });

    it('should throw NotFoundException if post not found', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(service.likePost('post-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
