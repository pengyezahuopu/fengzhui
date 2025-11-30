import { Injectable, BadRequestException } from '@nestjs/common';

export interface ContentCheckResult {
  pass: boolean;
  reason?: string;
  matchedWords?: string[];
}

@Injectable()
export class ContentSecurityService {
  // 环境开关：通过环境变量控制是否启用微信内容安全检测
  private readonly enableWxCheck =
    process.env.ENABLE_WX_CONTENT_CHECK === 'true';

  // 本地敏感词库 (基础版，生产环境应从配置或Redis加载)
  private sensitiveWords: string[] = [
    // 这里只放少量示例词，实际应从外部配置加载
    '违禁词示例1',
    '违禁词示例2',
  ];

  // DFA 算法的敏感词树
  private dfaTree: Map<string, any> = new Map();

  constructor() {
    this.buildDfaTree();
  }

  /**
   * 构建 DFA 敏感词树
   */
  private buildDfaTree(): void {
    for (const word of this.sensitiveWords) {
      let currentMap = this.dfaTree;
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        let subMap = currentMap.get(char);
        if (!subMap) {
          subMap = new Map();
          currentMap.set(char, subMap);
        }
        currentMap = subMap;
        if (i === word.length - 1) {
          currentMap.set('isEnd', true);
        }
      }
    }
  }

  /**
   * 本地敏感词检测 (DFA 算法)
   */
  private localSensitiveWordCheck(content: string): ContentCheckResult {
    const matchedWords: string[] = [];
    for (let i = 0; i < content.length; i++) {
      let currentMap = this.dfaTree;
      let matchLength = 0;
      let tempMatch = '';

      for (let j = i; j < content.length; j++) {
        const char = content[j];
        const subMap = currentMap.get(char);
        if (!subMap) {
          break;
        }
        tempMatch += char;
        matchLength++;
        currentMap = subMap;
        if (currentMap.get('isEnd')) {
          matchedWords.push(tempMatch);
        }
      }
    }

    if (matchedWords.length > 0) {
      return {
        pass: false,
        reason: '内容包含敏感词',
        matchedWords,
      };
    }

    return { pass: true };
  }

  /**
   * 微信小程序内容安全 API
   * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.msgSecCheck.html
   */
  private async wxMsgSecCheck(content: string): Promise<ContentCheckResult> {
    try {
      // 获取 access_token
      const accessToken = await this.getWxAccessToken();
      if (!accessToken) {
        // 获取 token 失败时降级，只使用本地检测
        console.warn('Failed to get WeChat access token, using local check only');
        return { pass: true };
      }

      const response = await fetch(
        `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: 2,
            scene: 2, // 评论/论坛场景
            openid: 'system_check', // 系统检测
            content,
          }),
        },
      );

      const result = await response.json();

      // errcode === 0 表示成功
      if (result.errcode === 0) {
        // result.result.suggest: 'pass' | 'review' | 'risky'
        if (result.result?.suggest === 'pass') {
          return { pass: true };
        } else {
          return {
            pass: false,
            reason: `微信内容安全检测: ${result.result?.suggest}`,
          };
        }
      }

      // API 调用失败，降级处理
      console.warn('WeChat content check API error:', result);
      return { pass: true }; // 降级通过
    } catch (error) {
      console.error('WeChat content check failed:', error);
      return { pass: true }; // 网络错误时降级通过
    }
  }

  /**
   * 获取微信 access_token
   */
  private async getWxAccessToken(): Promise<string | null> {
    const appId = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;

    if (!appId || !secret) {
      console.warn('WeChat credentials not configured');
      return null;
    }

    try {
      // TODO: 实际应使用 Redis 缓存 token，避免频繁请求
      const response = await fetch(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`,
      );
      const result = await response.json();
      return result.access_token || null;
    } catch (error) {
      console.error('Failed to get WeChat access token:', error);
      return null;
    }
  }

  /**
   * 综合内容安全检测
   * @param content 待检测的文本内容
   * @throws BadRequestException 如果内容不通过检测
   */
  async checkContent(content: string): Promise<ContentCheckResult> {
    // 1. 空内容直接通过
    if (!content || content.trim().length === 0) {
      return { pass: true };
    }

    // 2. 本地敏感词检测 (始终执行)
    const localResult = this.localSensitiveWordCheck(content);
    if (!localResult.pass) {
      return localResult;
    }

    // 3. 微信内容安全 API (仅在生产环境且开关开启时执行)
    if (this.enableWxCheck) {
      const wxResult = await this.wxMsgSecCheck(content);
      if (!wxResult.pass) {
        return wxResult;
      }
    }

    return { pass: true };
  }

  /**
   * 检测内容，如果不通过则抛出异常
   */
  async validateContent(content: string): Promise<void> {
    const result = await this.checkContent(content);
    if (!result.pass) {
      throw new BadRequestException(result.reason || '内容包含违规信息');
    }
  }

  /**
   * 加载外部敏感词库 (可由管理接口调用)
   */
  loadSensitiveWords(words: string[]): void {
    this.sensitiveWords = words;
    this.dfaTree = new Map();
    this.buildDfaTree();
  }
}
