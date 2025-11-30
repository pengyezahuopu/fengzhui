import { Module, Global } from '@nestjs/common';
import { ContentSecurityService } from './content-security.service';

@Global() // 全局模块，所有模块都可以注入
@Module({
  providers: [ContentSecurityService],
  exports: [ContentSecurityService],
})
export class ContentSecurityModule {}
