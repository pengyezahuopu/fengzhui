import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * 加密服务
 * 使用 AES-256-GCM 对敏感数据进行加密
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly salt: Buffer;
  private readonly key: Buffer;

  constructor() {
    // 从环境变量获取加密密钥，如果没有则使用默认值（仅用于开发）
    const secret = process.env.ENCRYPTION_SECRET || 'fengzhui-dev-secret-key-change-in-production';
    const saltHex = process.env.ENCRYPTION_SALT || 'fengzhui-salt-2024';

    this.salt = Buffer.from(saltHex, 'utf-8');
    this.key = scryptSync(secret, this.salt, this.keyLength);

    if (!process.env.ENCRYPTION_SECRET) {
      this.logger.warn(
        'ENCRYPTION_SECRET not set, using default key. This is NOT secure for production!',
      );
    }
  }

  /**
   * 加密字符串
   * @param plaintext 明文
   * @returns 加密后的字符串 (格式: iv:authTag:ciphertext，均为 hex 编码)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext;
    }

    try {
      const iv = randomBytes(this.ivLength);
      const cipher = createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // 格式: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * 解密字符串
   * @param ciphertext 密文 (格式: iv:authTag:ciphertext)
   * @returns 解密后的明文
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      return ciphertext;
    }

    // 检查是否是加密格式
    if (!this.isEncrypted(ciphertext)) {
      // 如果不是加密格式，可能是旧数据，直接返回
      return ciphertext;
    }

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
      }

      const [ivHex, authTagHex, encryptedData] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * 检查字符串是否是加密格式
   */
  isEncrypted(text: string): boolean {
    if (!text) {
      return false;
    }
    // 检查格式: iv(32 hex):authTag(32 hex):ciphertext
    const parts = text.split(':');
    if (parts.length !== 3) {
      return false;
    }
    // iv 应该是 32 个 hex 字符 (16 bytes)
    // authTag 应该是 32 个 hex 字符 (16 bytes)
    return parts[0].length === 32 && parts[1].length === 32 && /^[0-9a-f]+$/i.test(parts[0]);
  }

  /**
   * 对银行账号进行脱敏显示
   * @param account 银行账号（可能是加密的或明文的）
   * @returns 脱敏后的账号
   */
  maskBankAccount(account: string): string {
    if (!account) {
      return account;
    }

    // 如果是加密数据，先解密
    let plainAccount = account;
    if (this.isEncrypted(account)) {
      try {
        plainAccount = this.decrypt(account);
      } catch {
        // 解密失败，可能是旧的明文数据
        plainAccount = account;
      }
    }

    if (plainAccount.length < 8) {
      return plainAccount;
    }

    return plainAccount.slice(0, 4) + '****' + plainAccount.slice(-4);
  }

  /**
   * 对身份证号进行脱敏显示
   * @param idCard 身份证号（可能是加密的或明文的）
   * @returns 脱敏后的身份证号
   */
  maskIdCard(idCard: string): string {
    if (!idCard) {
      return idCard;
    }

    // 如果是加密数据，先解密
    let plainIdCard = idCard;
    if (this.isEncrypted(idCard)) {
      try {
        plainIdCard = this.decrypt(idCard);
      } catch {
        plainIdCard = idCard;
      }
    }

    if (plainIdCard.length < 10) {
      return plainIdCard;
    }

    // 显示前6位和后4位
    return plainIdCard.slice(0, 6) + '********' + plainIdCard.slice(-4);
  }

  /**
   * 对手机号进行脱敏显示
   * @param phone 手机号
   * @returns 脱敏后的手机号
   */
  maskPhone(phone: string): string {
    if (!phone) {
      return phone;
    }

    if (phone.length < 7) {
      return phone;
    }

    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }
}
