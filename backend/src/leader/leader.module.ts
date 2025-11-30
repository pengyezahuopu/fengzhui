import { Module } from '@nestjs/common';
import { LeaderService } from './leader.service';
import { LeaderController } from './leader.controller';

@Module({
  controllers: [LeaderController],
  providers: [LeaderService],
})
export class LeaderModule {}
