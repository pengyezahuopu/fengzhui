import { Controller, Get, Post, Put, Body, Param, Query, Headers } from '@nestjs/common';
import { UserService } from './user.service';
import * as jwt from 'jsonwebtoken';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Post()
  createUser(
    @Body()
    data: {
      openId?: string;
      phone?: string;
      nickname?: string;
      avatarUrl?: string;
    },
  ) {
    return this.userService.createUser(data);
  }

  @Put(':id')
  updateUser(
    @Param('id') id: string,
    @Body()
    data: {
      nickname?: string;
      avatarUrl?: string;
      phone?: string;
    },
  ) {
    return this.userService.updateUser(id, data);
  }

  @Post('login')
  async login(
    @Body()
    data: {
      openId: string;
      nickname?: string;
      avatarUrl?: string;
    },
  ) {
    const user = await this.userService.findOrCreateByOpenId(data.openId, {
      nickname: data.nickname,
      avatarUrl: data.avatarUrl,
    });

    // 生成真正的 JWT token
    const secret = process.env.JWT_SECRET || 'default-jwt-secret';
    const token = jwt.sign(
      {
        userId: user.id,
        openId: user.openId,
        role: user.role,
      },
      secret,
      { expiresIn: '7d' },
    );

    return {
      success: true,
      user,
      token,
    };
  }

  @Get(':id/enrollments')
  getUserEnrollments(@Param('id') id: string) {
    return this.userService.getUserEnrollments(id);
  }

  @Get(':id/profile')
  getUserProfile(
    @Param('id') userId: string,
    @Headers('x-user-id') currentUserId?: string,
  ) {
    return this.userService.getUserProfile(userId, currentUserId);
  }

  @Get(':id/stats')
  getUserStats(@Param('id') userId: string) {
    return this.userService.getUserStats(userId);
  }

  @Get(':id/posts')
  getUserPosts(
    @Param('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.userService.getUserPosts(userId, { cursor, limit });
  }

  @Get(':id/badges')
  getUserBadges(@Param('id') userId: string) {
    return this.userService.getUserBadges(userId);
  }
}
