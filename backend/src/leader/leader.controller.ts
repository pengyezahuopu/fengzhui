import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { LeaderService } from './leader.service';

@Controller('leaders')
export class LeaderController {
  constructor(private readonly leaderService: LeaderService) {}

  @Post()
  createLeader(@Body() data: { userId: string; realName: string; idCard: string; bio?: string }) {
    return this.leaderService.createLeaderProfile(data);
  }

  @Post('join-club')
  joinClub(@Body() data: { leaderId: string; clubId: string }) {
    return this.leaderService.joinClub(data.leaderId, data.clubId);
  }

  @Get(':id')
  getLeaderById(@Param('id') id: string) {
    return this.leaderService.getLeaderById(id);
  }
}
