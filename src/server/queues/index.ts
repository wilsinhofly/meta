/**
 * BullMQ Queues Architecture
 * 3 Filas separadas conforme o Blueprint:
 * 1. whatsapp-inbound: processa webhooks do WhatsApp, deduplica wamid e roda máquina de estados
 * 2. catalog-sync: processa deltas de catálogo e envia lotes para Meta Commerce Manager Batch API
 * 3. instagram-publisher: executa o pipeline assíncrono em 2 fases (Container Creation -> Polling -> Publish)
 */

export interface QueueJob<T = any> {
  id: string;
  name: string;
  data: T;
  queueName: 'whatsapp-inbound' | 'catalog-sync' | 'instagram-publisher';
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  attempts: number;
  error?: string;
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
  result?: any;
}

export type JobHandler<T = any> = (job: QueueJob<T>) => Promise<any>;

class AppQueue<T = any> {
  public name: 'whatsapp-inbound' | 'catalog-sync' | 'instagram-publisher';
  private jobs: QueueJob<T>[] = [];
  private handlers: JobHandler<T>[] = [];
  private isProcessing = false;

  constructor(name: 'whatsapp-inbound' | 'catalog-sync' | 'instagram-publisher') {
    this.name = name;
  }

  async add(name: string, data: T, opts?: { delay?: number; attempts?: number }): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      data,
      queueName: this.name,
      status: 'waiting',
      progress: 0,
      attempts: 0,
      createdAt: Date.now(),
    };

    this.jobs.unshift(job);

    // Se houver delay, agenda a execução; caso contrário, dispara o worker
    if (opts?.delay && opts.delay > 0) {
      setTimeout(() => {
        this.processNext();
      }, opts.delay);
    } else {
      setTimeout(() => {
        this.processNext();
      }, 50);
    }

    return job;
  }

  process(handler: JobHandler<T>) {
    this.handlers.push(handler);
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.handlers.length === 0) return;

    const waitingJob = this.jobs.slice().reverse().find((j) => j.status === 'waiting');
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

// Instâncias das 3 Filas separadas do Blueprint
export const whatsappQueue = new AppQueue('whatsapp-inbound');
export const catalogSyncQueue = new AppQueue('catalog-sync');
export const instagramPublishQueue = new AppQueue('instagram-publisher');

export async function getAllQueueMetrics() {
  const [wa, cat, ig] = await Promise.all([
    whatsappQueue.getCounts(),
    catalogSyncQueue.getCounts(),
    instagramPublishQueue.getCounts(),
  ]);

  return {
    whatsapp: wa,
    catalog: cat,
    instagram: ig,
    system: {
      uptimeSec: Math.floor(process.uptime()),
      timestamp: Date.now(),
      mode: 'ACTIVE_EVENT_LOOP',
    },
  };
}

export async function getAllRecentJobs(limit = 40) {
  const [waJobs, catJobs, igJobs] = await Promise.all([
    whatsappQueue.getJobs(undefined, limit),
    catalogSyncQueue.getJobs(undefined, limit),
    instagramPublishQueue.getJobs(undefined, limit),
  ]);

  return [...waJobs, ...catJobs, ...igJobs]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
