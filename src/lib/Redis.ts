/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'redis';

export default class Redis {
  constructor() {
    this.client = null
  }

  private static redisUrl(): string {
    return process.env.REDISCLOUD_URL || 'redis://127.0.0.1:6379/0'
  }

  async getAsync(key: string): Promise<string | null> {
    const client = await this.redisClient()
    return client.get(key)
  }

  async setAsync(key: string, value: string, exp?: number): Promise<void> {
    const client = await this.redisClient()
    if (exp != null) {
      await client.set(key, value, 'EX', exp)
    } else {
      await client.set(key, value)
    }
  }

  async setExAsync(key: string, value: string, exp: number): Promise<void> {
    await this.setAsync(key, value, exp)
  }

  async getObjectAsync(key: string): Promise<any | null> {
    const redisString = await this.getAsync(key)
    if (redisString === null) return null;
    return JSON.parse(redisString)
  };

  async setObjectAsync(key: string, value: any): Promise<void> {
    const jsonString = JSON.stringify(value)
    await this.setAsync(key, jsonString)
  };

  async setExObjectAsync(key: string, value: any, exp: number): Promise<void> {
    const jsonString = JSON.stringify(value)
    await this.setExAsync(key, jsonString, exp)
  };

  private async redisClient(): Promise<any> {
    if (this.client) return this.client;
    this.client = createClient({ url: Redis.redisUrl() })
    await this.client.connect()
    return this.client
  }

  client: any
}
