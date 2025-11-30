import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { randomUUID } from 'crypto';

export interface LockOptions {
  /** 锁的过期时间(毫秒)，默认30秒 */
  ttlMs?: number;
  /** 获取锁的重试次数，默认3次 */
  retryCount?: number;
  /** 重试间隔(毫秒)，默认100ms */
  retryDelayMs?: number;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
}

/**
 * 分布式锁服务
 * 基于 Redis SET NX EX 实现，防止并发操作导致的数据不一致
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly defaultTtlMs = 30000; // 30秒
  private readonly defaultRetryCount = 3;
  private readonly defaultRetryDelayMs = 100;

  constructor(private readonly redisService: RedisService) {}

  /**
   * 获取分布式锁
   * @param key 锁的键名
   * @param options 锁配置
   * @returns 锁结果，包含是否获取成功和锁ID
   */
  async acquireLock(key: string, options?: LockOptions): Promise<LockResult> {
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const retryCount = options?.retryCount ?? this.defaultRetryCount;
    const retryDelayMs = options?.retryDelayMs ?? this.defaultRetryDelayMs;
    const lockId = randomUUID();
    const lockKey = `lock:${key}`;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const client = this.redisService.getClient();
        // SET key value NX PX ttl - 只在key不存在时设置，并设置过期时间
        const result = await client.set(lockKey, lockId, 'PX', ttlMs, 'NX');

        if (result === 'OK') {
          this.logger.debug(`Lock acquired: ${lockKey}, lockId: ${lockId}`);
          return { acquired: true, lockId };
        }

        if (attempt < retryCount) {
          await this.sleep(retryDelayMs);
        }
      } catch (error) {
        this.logger.error(`Failed to acquire lock ${lockKey}:`, error);
        if (attempt < retryCount) {
          await this.sleep(retryDelayMs);
        }
      }
    }

    this.logger.warn(`Failed to acquire lock after ${retryCount + 1} attempts: ${lockKey}`);
    return { acquired: false };
  }

  /**
   * 释放分布式锁
   * 使用 Lua 脚本确保只有锁的持有者才能释放锁
   * @param key 锁的键名
   * @param lockId 获取锁时返回的锁ID
   */
  async releaseLock(key: string, lockId: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const client = this.redisService.getClient();

    // Lua 脚本：只有当锁的值等于lockId时才删除
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await client.eval(luaScript, 1, lockKey, lockId);
      const released = result === 1;

      if (released) {
        this.logger.debug(`Lock released: ${lockKey}, lockId: ${lockId}`);
      } else {
        this.logger.warn(`Lock not released (not owner or expired): ${lockKey}`);
      }

      return released;
    } catch (error) {
      this.logger.error(`Failed to release lock ${lockKey}:`, error);
      return false;
    }
  }

  /**
   * 在锁保护下执行操作
   * @param key 锁的键名
   * @param fn 要执行的函数
   * @param options 锁配置
   * @returns 函数执行结果
   * @throws 如果获取锁失败，抛出错误
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: LockOptions,
  ): Promise<T> {
    const lockResult = await this.acquireLock(key, options);

    if (!lockResult.acquired || !lockResult.lockId) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, lockResult.lockId);
    }
  }

  /**
   * 尝试在锁保护下执行操作，如果获取锁失败则返回null
   * @param key 锁的键名
   * @param fn 要执行的函数
   * @param options 锁配置
   * @returns 函数执行结果或null
   */
  async tryWithLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: LockOptions,
  ): Promise<T | null> {
    const lockResult = await this.acquireLock(key, options);

    if (!lockResult.acquired || !lockResult.lockId) {
      this.logger.debug(`Could not acquire lock for key: ${key}, skipping operation`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, lockResult.lockId);
    }
  }

  /**
   * 延长锁的过期时间
   * @param key 锁的键名
   * @param lockId 锁ID
   * @param ttlMs 新的过期时间(毫秒)
   */
  async extendLock(key: string, lockId: string, ttlMs: number): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const client = this.redisService.getClient();

    // Lua 脚本：只有当锁的值等于lockId时才延长过期时间
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await client.eval(luaScript, 1, lockKey, lockId, ttlMs);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to extend lock ${lockKey}:`, error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
