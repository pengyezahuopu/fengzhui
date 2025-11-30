import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';

@Controller('enrollments')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post()
  createEnrollment(
    @Body()
    data: {
      activityId: string;
      userId: string;
      contactName: string;
      contactPhone: string;
    },
  ) {
    return this.enrollmentService.createEnrollment(data);
  }

  @Get(':id')
  getEnrollmentById(@Param('id') id: string) {
    return this.enrollmentService.getEnrollmentById(id);
  }

  @Delete(':id')
  cancelEnrollment(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    return this.enrollmentService.cancelEnrollment(id, userId);
  }

  @Post(':id/pay')
  confirmPayment(@Param('id') id: string) {
    return this.enrollmentService.confirmPayment(id);
  }

  @Post(':id/check-in')
  checkIn(@Param('id') id: string) {
    return this.enrollmentService.checkIn(id);
  }

  @Get('activity/:activityId')
  getActivityEnrollments(@Param('activityId') activityId: string) {
    return this.enrollmentService.getActivityEnrollments(activityId);
  }

  @Get('user/:userId')
  getUserEnrollments(@Param('userId') userId: string) {
    return this.enrollmentService.getUserEnrollments(userId);
  }
}
