// Mock for BullMQ Queue class
class MockQueue<T = any> {
  name: string;
  private jobs: Array<{ id: string; data: T }> = [];
  private eventHandlers: Record<string, Array<(...args: any[]) => void>> = {};

  constructor(name: string) {
    this.name = name;
  }

  async add(name: string, data: T, opts?: any): Promise<{ id: string }> {
    const job = {
      id: opts?.jobId || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
    this.jobs.push(job);

    // Simulate job completion after a short delay
    setTimeout(() => {
      this.emit('completed', job, 'success');
    }, 10);

    return { id: job.id };
  }

  async getJob(id: string): Promise<{ id: string; data: T } | undefined> {
    return this.jobs.find((job) => job.id === id);
  }

  async getJobs(): Promise<Array<{ id: string; data: T }>> {
    return [...this.jobs];
  }

  async close(): Promise<void> {
    // Cleanup
    this.jobs = [];
    this.eventHandlers = {};
  }

  // Event handling
  on(event: string, callback: (...args: any[]) => void): this {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
    return this;
  }

  // Helper to emit events
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers[event] || [];
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (e) {
        console.error(`Error in ${event} handler:`, e);
      }
    }
  }
}

// Mock for Worker class
class MockWorker<T = any> {
  name: string;
  private processor: (job: { data: T }) => Promise<any>;
  private isRunning = false;

  constructor(queueName: string, processor: (job: { data: T }) => Promise<any>) {
    this.name = queueName;
    this.processor = processor;
  }

  async close(): Promise<void> {
    this.isRunning = false;
  }
}

// Export mocks
export const Queue = MockQueue;
export const Worker = MockWorker;
export const QueueScheduler = class {}; // No-op for testing
export const QueueEvents = class {}; // No-op for testing
