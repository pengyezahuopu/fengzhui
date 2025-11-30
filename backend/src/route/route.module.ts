import { Module } from '@nestjs/common';
import { RouteController } from './route.controller';
import { RouteService } from './route.service';
import { PrismaModule } from '../prisma.module';
import { GisModule } from '../gis/gis.module';

@Module({
  imports: [PrismaModule, GisModule],
  controllers: [RouteController],
  providers: [RouteService],
  exports: [RouteService],
})
export class RouteModule {}
