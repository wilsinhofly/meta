/**
 * BullMQ Queues Architecture
 * 4 Filas separadas:
 * 1. whatsapp-inbound: processa webhooks do WhatsApp, deduplica wamid e roda máquina de estados
 * 2. catalog-sync: processa deltas de catálogo e envia lotes para Meta Commerce Manager Batch API
 * 3. instagram-publisher: executa o pipeline assíncrono em 2 fases (Container Creation -> Polling -> Publish)
 * 4. instagram-token-refresh: job recorrente a cada 7 dias para renovar o long-lived token via ig_refresh_token
 */

export type QueueName =
  | 'whatsapp-inbound'
  | 'catalog-sync'
  | 'instagram-publisher'
  | 'instagram-token-refresh';

export interface QueueJob<T = any> {
  id: string;
  name: string;
  data: T;
  queueName: QueueName;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  attempts: number;
  error?: string;
  createdAt: number;
  delayUntil?: number;
  processedAt?: number;
  completedAt?: number;
  result?: any;
}

export type JobHandler<T = any> = (job: QueueJob<T>) => Promise<any>;

class AppQueue<T = any> {
  public name: QueueName;
  private jobs: QueueJob<T>[] = [];
  private handlers: JobHandler<T>[] = [];
  private isProcessing = false;
  private intervals: NodeJS.Timeout[] = [];

  constructor(name: QueueName) {
    this.name = name;
  }

  async add(name: string, data: T, opts?: { delay?: number; attempts?: number }): Promise<QueueJob<T>> {
    const delay = opts?.delay && opts.delay > 0 ? opts.delay : 0;
    const now = Date.now();
    const job: QueueJob<T> = {
      id: `${this.name}-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      data,
      queueName: this.name,
      status: 'waiting',
      progress: 0,
      attempts: 0,
      createdAt: now,
      delayUntil: delay > 0 ? now + delay : undefined,
    };

    this.jobs.unshift(job);

    // Se houver delay, agenda a execução; caso contrário, dispara o worker
    if (delay > 0) {
      setTimeout(() => {
        this.processNext();
      }, delay);
    } else {
      setTimeout(() => {
        this.processNext();
      }, 50);
    }

    return job;
  }

  /**
   * Adiciona um repeatable job que dispara periodicamente (compatível com BullMQ repeatable jobs)
   */
  addRepeatableJob(name: string, data: T, intervalMs: number, runImmediately = true) {
    if (runImmediately) {
      this.add(name, data);
    }
    const timer = setInterval(() => {
      this.add(name, data);
    }, intervalMs);
    this.intervals.push(timer);
  }

  process(handler: JobHandler<T>) {
    this.handlers.push(handler);
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.handlers.length === 0) return;

    const now = Date.now();
    const waitingJob = this.jobs
      .slice()
      .reverse()
      .find((j) => j.status === 'waiting' && (!j.delayUntil || j.delayUntil <= now));

    if (!waitingJob) return;

    this.isProcessing = true;
    waitingJob.status = 'active';
    waitingJob.processedAt = Date.now();
    waitingJob.attempts += 1;

    try {
      for (const handler of this.handlers) {
        waitingJob.result = await handler(waitingJob);
      }
      waitingJob.status = 'completed';
      waitingJob.progress = 100;
      waitingJob.completedAt = Date.now();
    } catch (err: any) {
      waitingJob.status = 'failed';
      waitingJob.error = err?.message || 'Erro desconhecido durante execução do job';
      waitingJob.completedAt = Date.now();
    } finally {
      this.isProcessing = false;
      // Process next job in queue if any
      setTimeout(() => this.processNext(), 100);
    }
  }

  async getJobs(status?: QueueJob['status'], limit = 50): Promise<QueueJob<T>[]> {
    if (!status) return this.jobs.slice(0, limit);
    return this.jobs.filter((j) => j.status === status).slice(0, limit);
  }

  async getCounts() {
    return {
      waiting: this.jobs.filter((j) => j.status === 'waiting').length,
      active: this.jobs.filter((j) => j.status === 'active').length,
      completed: this.jobs.filter((j) => j.status === 'completed').length,
      failed: this.jobs.filter((j) => j.status === 'failed').length,
      total: this.jobs.length,
    };
  }

  async retry(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job && job.status === 'failed') {
      job.status = 'waiting';
      job.error = undefined;
      this.processNext();
      return true;
    }
    return false;
  }
}

// Instâncias das Filas
export const whatsappQueue = new AppQueue('whatsapp-inbound');
export const catalogSyncQueue = new AppQueue('catalog-sync');
export const instagramPublishQueue = new AppQueue('instagram-publisher');
export const instagramTokenRefreshQueue = new AppQueue('instagram-token-refresh');

export async function getAllQueueMetrics() {
  const [wa, cat, ig, refresh] = await Promise.all([
    whatsappQueue.getCounts(),
    catalogSyncQueue.getCounts(),
    instagramPublishQueue.getCounts(),
    instagramTokenRefreshQueue.getCounts(),
  ]);

  return {
    whatsapp: wa,
    catalog: cat,
    instagram: ig,
    tokenRefresh: refresh,
    system: {
      uptimeSec: Math.floor(process.uptime()),
      timestamp: Date.now(),
      mode: 'ACTIVE_EVENT_LOOP',
    },
  };
}

export async function getAllRecentJobs(limit = 40) {
  const [waJobs, catJobs, igJobs, refreshJobs] = await Promise.all([
    whatsappQueue.getJobs(undefined, limit),
    catalogSyncQueue.getJobs(undefined, limit),
    instagramPublishQueue.getJobs(undefined, limit),
    instagramTokenRefreshQueue.getJobs(undefined, limit),
  ]);

  return [...waJobs, ...catJobs, ...igJobs, ...refreshJobs]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
