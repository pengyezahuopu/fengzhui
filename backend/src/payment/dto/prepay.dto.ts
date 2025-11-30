import { IsString, IsNotEmpty } from 'class-validator';

export class PrepayDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  openId: string;
}

// 微信支付预支付返回给前端的参数
export class PrepayResultDto {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}
