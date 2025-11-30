import { Module } from '@nestjs/common';
import { GpxParserService } from './gpx-parser.service';

@Module({
  providers: [GpxParserService],
  exports: [GpxParserService],
})
export class GisModule {}
