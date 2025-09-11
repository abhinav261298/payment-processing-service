// Mock Redis client for testing
class MockRedis {
  private data: Map<string, any> = new Map();
  private connected = true;

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result: Record<string, string> = {};
    for (const [k, v] of this.data.entries()) {
      if (k.startsWith(`${key}:`)) {
        result[k.replace(`${key}:`, '')] = v;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    this.data.set(`${key}:${field}`, value);
    return 1;
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.data.delete(`${key}:${field}`) ? 1 : 0;
  }

  async quit(): Promise<'OK'> {
    this.connected = false;
    return 'OK';
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Add other Redis methods as needed for your tests
}

// Mock the IORedis class
export default class IORedis {
  private client: MockRedis;

  constructor() {
    this.client = new MockRedis();
  }

  // Delegate method calls to the mock client
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<'OK'> {
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    return this.client.hgetall(key);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.client.hdel(key, field);
  }

  async quit(): Promise<'OK'> {
    return this.client.quit();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  // Add other Redis methods as needed for your tests
  // This is a simplified mock - extend with more methods as needed
  duplicate() {
    return this;
  }

  disconnect() {
    // No-op for testing
  }

  // Add other IORedis specific methods as needed
}
