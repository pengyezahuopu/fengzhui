import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS 配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Swagger API 文档配置
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('风追 API')
      .setDescription(`
风追 - 户外活动管理平台 API 文档

## 认证方式
所有需要认证的接口请在请求头中携带 \`Authorization: Bearer <token>\`

## 接口限流
- 默认限制: 100次/分钟
- 敏感接口 (登录/支付): 10次/分钟
- 短信接口: 5次/分钟

## 错误码
- 400: 请求参数错误
- 401: 未认证
- 403: 无权限
- 404: 资源不存在
- 429: 请求过于频繁
- 500: 服务器内部错误
      `)
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '请输入 JWT Token',
        },
        'JWT',
      )
      .addTag('用户', '用户认证与信息管理')
      .addTag('俱乐部', '俱乐部管理')
      .addTag('活动', '活动发布与管理')
      .addTag('报名', '活动报名')
      .addTag('订单', '订单管理')
      .addTag('支付', '支付相关')
      .addTag('线路', '户外线路管理')
      .addTag('社交', '帖子、评论、关注')
      .addTag('财务', '账户、结算、提现')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });

    console.log(`Swagger documentation available at: http://localhost:3000/api-docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
