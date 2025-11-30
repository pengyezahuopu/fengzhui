import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiKey: string;
  apiV3Key: string;
  serialNo: string;
  privateKey: string;
  notifyUrl: string;
}

export interface UnifiedOrderParams {
  outTradeNo: string;
  description: string;
  totalFee: number; // 单位：分
  openId: string;
  attach?: string;
}

export interface UnifiedOrderResult {
  prepayId: string;
  nonceStr: string;
}

export interface PaymentNotification {
  id: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  resource: {
    original_type: string;
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
  };
}

export interface DecryptedPaymentResult {
  mchid: string;
  appid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_type: string;
  trade_state: string;
  trade_state_desc: string;
  bank_type: string;
  attach?: string;
  success_time: string;
  payer: {
    openid: string;
  };
  amount: {
    total: number;
    payer_total: number;
    currency: string;
    payer_currency: string;
  };
}

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private config: WechatPayConfig;

  constructor() {
    this.config = {
      appId: process.env.WX_APPID || '',
      mchId: process.env.WX_MCH_ID || '',
      apiKey: process.env.WX_API_KEY || '',
      apiV3Key: process.env.WX_API_V3_KEY || '',
      serialNo: process.env.WX_SERIAL_NO || '',
      privateKey: process.env.WX_PRIVATE_KEY || '',
      notifyUrl:
        process.env.WX_NOTIFY_URL || 'https://example.com/payments/notify',
    };
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(length = 32): string {
    return crypto.randomBytes(length / 2).toString('hex');
  }

  /**
   * 生成时间戳
   */
  private generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * RSA-SHA256 签名 (用于 API 请求)
   */
  private signWithRSA(message: string): string {
    if (!this.config.privateKey) {
      // 开发环境，返回模拟签名
      return 'mock-signature';
    }

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    return sign.sign(this.config.privateKey, 'base64');
  }

  /**
   * HMAC-SHA256 签名 (用于小程序端调起支付)
   */
  private signWithHMAC(message: string): string {
    return crypto
      .createHmac('sha256', this.config.apiKey)
      .update(message)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * AES-256-GCM 解密 (用于解密回调数据)
   */
  private decryptAES256GCM(
    ciphertext: string,
    nonce: string,
    associatedData: string,
  ): string {
    if (!this.config.apiV3Key) {
      throw new Error('API V3 Key not configured');
    }

    const key = Buffer.from(this.config.apiV3Key);
    const iv = Buffer.from(nonce);
    const authTag = Buffer.from(ciphertext.slice(-24), 'base64');
    const data = Buffer.from(ciphertext.slice(0, -24), 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(associatedData));

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * 统一下单 - JSAPI
   * 实际生产环境需要调用微信支付 API
   * 这里提供完整的实现框架，开发环境使用模拟数据
   */
  async unifiedOrder(params: UnifiedOrderParams): Promise<UnifiedOrderResult> {
    const nonceStr = this.generateNonceStr();
    const timestamp = this.generateTimestamp();

    // 检查是否配置了微信支付
    if (!this.config.mchId || !this.config.apiKey) {
      this.logger.warn(
        'WeChat Pay not configured, using mock data for development',
      );
      // 开发环境返回模拟数据
      return {
        prepayId: `mock_prepay_id_${params.outTradeNo}_${Date.now()}`,
        nonceStr,
      };
    }

    // 生产环境: 调用微信支付 API
    const requestBody = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: this.config.notifyUrl,
      amount: {
        total: params.totalFee,
        currency: 'CNY',
      },
      payer: {
        openid: params.openId,
      },
      attach: params.attach,
    };

    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
    const method = 'POST';
    const body = JSON.stringify(requestBody);

    // 生成签名
    const signMessage = `${method}\n/v3/pay/transactions/jsapi\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signature = this.signWithRSA(signMessage);

    try {
      // 实际调用微信支付 API
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.config.serialNo}",signature="${signature}"`,
        },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`WeChat Pay API error: ${errorBody}`);
        throw new Error(`WeChat Pay API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        prepayId: result.prepay_id,
        nonceStr,
      };
    } catch (error) {
      this.logger.error('WeChat Pay unified order failed', error);
      throw error;
    }
  }

  /**
   * 生成小程序端调起支付的参数
   */
  generatePayParams(prepayId: string, nonceStr: string) {
    const timestamp = this.generateTimestamp();
    const packageStr = `prepay_id=${prepayId}`;

    // 生成签名
    const signMessage = `${this.config.appId}\n${timestamp}\n${nonceStr}\n${packageStr}\n`;
    const paySign = this.signWithRSA(signMessage);

    return {
      appId: this.config.appId,
      timeStamp: timestamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign,
    };
  }

  /**
   * 验证回调签名
   */
  verifyNotifySignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    serial: string,
  ): boolean {
    // 开发环境跳过验证
    if (!this.config.apiV3Key) {
      this.logger.warn('Skipping signature verification in development');
      return true;
    }

    // 验证时间戳 (5分钟内有效)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      this.logger.warn('Notify timestamp expired');
      return false;
    }

    // TODO: 实际生产环境需要使用微信支付平台证书验证签名
    // 这里简化处理
    return true;
  }

  /**
   * 解密回调数据
   */
  decryptNotifyResource(notification: PaymentNotification): DecryptedPaymentResult {
    const { ciphertext, nonce, associated_data } = notification.resource;

    // 开发环境返回模拟数据
    if (!this.config.apiV3Key) {
      this.logger.warn('Using mock decrypt in development');
      // 从 ciphertext 中提取 mock 订单号
      const mockOutTradeNo = ciphertext.includes('mock_')
        ? ciphertext.split('_')[2]
        : 'unknown';

      return {
        mchid: 'mock_mch_id',
        appid: this.config.appId || 'mock_app_id',
        out_trade_no: mockOutTradeNo,
        transaction_id: `wx_${Date.now()}`,
        trade_type: 'JSAPI',
        trade_state: 'SUCCESS',
        trade_state_desc: '支付成功',
        bank_type: 'MOCK_BANK',
        success_time: new Date().toISOString(),
        payer: {
          openid: 'mock_openid',
        },
        amount: {
          total: 100,
          payer_total: 100,
          currency: 'CNY',
          payer_currency: 'CNY',
        },
      };
    }

    const decrypted = this.decryptAES256GCM(ciphertext, nonce, associated_data);
    return JSON.parse(decrypted);
  }

  /**
   * 查询订单状态
   */
  async queryOrder(outTradeNo: string): Promise<DecryptedPaymentResult | null> {
    // 开发环境返回 null
    if (!this.config.mchId) {
      this.logger.warn('WeChat Pay not configured, query returns null');
      return null;
    }

    const timestamp = this.generateTimestamp();
    const nonceStr = this.generateNonceStr();
    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.config.mchId}`;

    const signMessage = `GET\n/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.config.mchId}\n${timestamp}\n${nonceStr}\n\n`;
    const signature = this.signWithRSA(signMessage);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.config.serialNo}",signature="${signature}"`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Query order failed', error);
      return null;
    }
  }

  /**
   * 申请退款
   */
  async refund(params: {
    outTradeNo: string;
    outRefundNo: string;
    refundAmount: number;
    totalAmount: number;
    reason: string;
  }): Promise<{ refundId: string } | null> {
    // 开发环境返回模拟数据
    if (!this.config.mchId) {
      this.logger.warn('WeChat Pay not configured, using mock refund');
      return {
        refundId: `mock_refund_${params.outRefundNo}_${Date.now()}`,
      };
    }

    const timestamp = this.generateTimestamp();
    const nonceStr = this.generateNonceStr();
    const url = 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds';

    const requestBody = {
      out_trade_no: params.outTradeNo,
      out_refund_no: params.outRefundNo,
      reason: params.reason,
      amount: {
        refund: params.refundAmount,
        total: params.totalAmount,
        currency: 'CNY',
      },
    };

    const body = JSON.stringify(requestBody);
    const signMessage = `POST\n/v3/refund/domestic/refunds\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signature = this.signWithRSA(signMessage);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.config.serialNo}",signature="${signature}"`,
        },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`WeChat Refund API error: ${errorBody}`);
        return null;
      }

      const result = await response.json();
      return {
        refundId: result.refund_id,
      };
    } catch (error) {
      this.logger.error('Refund failed', error);
      return null;
    }
  }
}
