import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityStatus } from '@prisma/client';

@Controller('activities')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  createActivity(
    @Body()
    data: {
      title: string;
      coverUrl?: string;
      startTime: Date;
      endTime: Date;
      routeId: string;
      clubId: string;
      leaderId: string;
      price: number;
      maxPeople: number;
      minPeople?: number;
    },
  ) {
    return this.activityService.createActivity(data);
  }

  @Get()
  getActivities(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ActivityStatus,
    @Query('clubId') clubId?: string,
  ) {
    return this.activityService.getActivities({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      clubId,
    });
  }

  @Get('recommended')
  getRecommendedActivities(@Query('limit') limit?: string) {
    return this.activityService.getRecommendedActivities(
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':id')
  getActivityById(@Param('id') id: string) {
    return this.activityService.getActivityById(id);
  }

  @Put(':id')
  updateActivity(
    @Param('id') id: string,
    @Body()
    data: {
      title?: string;
      coverUrl?: string;
      startTime?: Date;
      endTime?: Date;
      price?: number;
      maxPeople?: number;
      minPeople?: number;
      status?: ActivityStatus;
    },
  ) {
    return this.activityService.updateActivity(id, data);
  }

  @Post(':id/publish')
  publishActivity(@Param('id') id: string) {
    return this.activityService.publishActivity(id);
  }

  @Post(':id/cancel')
  cancelActivity(@Param('id') id: string) {
    return this.activityService.cancelActivity(id);
  }

  @Delete(':id')
  deleteActivity(@Param('id') id: string) {
    return this.activityService.deleteActivity(id);
  }
}
