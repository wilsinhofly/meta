export interface Product {
  id: string;
  retailerId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  availability: 'in stock' | 'out of stock';
  condition: 'new' | 'refurbished' | 'used';
  url: string;
  imageUrl: string;
  brand: string;
  category: string;
  metaCatalogId?: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  lastSyncedAt?: string;
  syncError?: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  waId: string;
  contactName: string;
  state: 'BOT_ROUTING' | 'BOT_IN_MENU' | 'HUMAN_QUEUE' | 'HUMAN_ACTIVE' | 'CLOSED';
  lastMessageAt: string;
  messages: Array<{
    id: string;
    wamid: string;
    direction: 'INBOUND' | 'OUTBOUND';
    type: string;
    body: string;
    timestamp: string;
    payload?: any;
  }>;
}

export interface InstagramPost {
  id: string;
  igUserId: string;
  mediaType: 'IMAGE' | 'REELS' | 'CAROUSEL' | 'STORIES';
  caption: string;
  mediaUrl: string;
  scheduledFor?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING_CONTAINER' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'FAILED';
  containerId?: string;
  metaMediaId?: string;
  errorCode?: string;
  errorMessage?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface QueueJobItem {
  id: string;
  name: string;
  queueName: 'whatsapp-inbound' | 'catalog-sync' | 'instagram-publisher';
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  attempts: number;
  error?: string;
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
  data: any;
  result?: any;
}

export interface QueueMetrics {
  whatsapp: { waiting: number; active: number; completed: number; failed: number; total: number };
  catalog: { waiting: number; active: number; completed: number; failed: number; total: number };
  instagram: { waiting: number; active: number; completed: number; failed: number; total: number };
  system: { uptimeSec: number; timestamp: number; mode: string };
}
