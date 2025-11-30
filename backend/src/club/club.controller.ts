import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ClubService } from './club.service';

@Controller('clubs')
export class ClubController {
  constructor(private readonly clubService: ClubService) {}

  @Post()
  createClub(@Body() data: { name: string; ownerId: string; description?: string }) {
    return this.clubService.createClub(data);
  }

  @Get()
  getAllClubs() {
    return this.clubService.getAllClubs();
  }

  @Get(':id')
  getClubById(@Param('id') id: string) {
    return this.clubService.getClubById(id);
  }
}
