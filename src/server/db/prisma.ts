/**
 * Prisma Database Client & In-Memory Store
 * Suporta tanto conexão real PostgreSQL via @prisma/client
 * quanto armazenamento em memória para testes e prototipagem no container.
 */

export interface ProductData {
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
  lastSyncedAt?: Date;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationData {
  id: string;
  contactId: string;
  waId: string;
  contactName: string;
  state: 'BOT_ROUTING' | 'BOT_IN_MENU' | 'HUMAN_QUEUE' | 'HUMAN_ACTIVE' | 'CLOSED';
  lastMessageAt: Date;
  messages: Array<{
    id: string;
    wamid: string;
    direction: 'INBOUND' | 'OUTBOUND';
    type: string;
    body: string;
    timestamp: Date;
    payload?: any;
  }>;
}

export interface InstagramPostData {
  id: string;
  campaignId?: string;
  igUserId: string;
  mediaType: 'IMAGE' | 'REELS' | 'STORIES';
  caption: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  scheduledFor?: Date;
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING_CONTAINER' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'CANCELLED' | 'FAILED';
  containerId?: string;
  metaMediaId?: string;
  errorCode?: string;
  errorMessage?: string;
  publishedAt?: Date;
  createdAt: Date;
}

export interface MetaCredentialData {
  id: string;
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'COMMERCE' | 'FACEBOOK_PAGE';
  tokenType: 'SYSTEM_USER' | 'PAGE_ACCESS' | 'USER_ACCESS';
  token: string;
  expiresAt?: Date | null;
  isValid: boolean;
  lastCheckedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const initialProducts: ProductData[] = [
  {
    id: 'prod-1',
    retailerId: 'SKU-TENIS-AZUL-42',
    title: 'Tênis Running Performance Azul Tam 42',
    description: 'Amortecimento com retorno de energia, cabedal respirável em mesh.',
    price: 29990,
    currency: 'BRL',
    availability: 'in stock',
    condition: 'new',
    url: 'https://sualoja.com.br/produtos/tenis-running-azul',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    brand: 'MinhaMarca',
    category: 'Calçados Esportivos',
    metaCatalogId: '123456789012345',
    syncStatus: 'SYNCED',
    lastSyncedAt: new Date(Date.now() - 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-2',
    retailerId: 'SKU-CAMISA-PRETA-G',
    title: 'Camisa Casual Preta 100% Algodão',
    description: 'Modelagem slim fit, tecido peletizado com toque extra macio.',
    price: 8990,
    currency: 'BRL',
    availability: 'in stock',
    condition: 'new',
    url: 'https://sualoja.com.br/produtos/camisa-preta-g',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80',
    brand: 'MinhaMarca',
    category: 'Vestuário',
    metaCatalogId: '123456789012345',
    syncStatus: 'SYNCED',
    lastSyncedAt: new Date(Date.now() - 7200000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-3',
    retailerId: 'SKU-RELOGIO-SMART-V2',
    title: 'Smartwatch Pro Titanium Edition',
    description: 'Monitoramento cardíaco contínuo, GPS integrado e resistência à água 50m.',
    price: 64900,
    currency: 'BRL',
    availability: 'in stock',
    condition: 'new',
    url: 'https://sualoja.com.br/produtos/smartwatch-pro',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
    brand: 'MinhaMarca',
    category: 'Acessórios',
    metaCatalogId: '123456789012345',
    syncStatus: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-4',
    retailerId: 'SKU-MOCHILA-URBANA-COU',
    title: 'Mochila Urbana Couro Sintético Reforçada',
    description: 'Compartimento para notebook até 16", zíperes impermeáveis e alça ergonômica.',
    price: 18990,
    currency: 'BRL',
    availability: 'in stock',
    condition: 'new',
    url: 'https://sualoja.com.br/produtos/mochila-urbana',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    brand: 'MinhaMarca',
    category: 'Acessórios',
    metaCatalogId: '123456789012345',
    syncStatus: 'SYNCED',
    lastSyncedAt: new Date(Date.now() - 10800000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

const initialConversations: ConversationData[] = [
  {
    id: 'conv-1',
    contactId: 'ct-1',
    waId: '5511987654321',
    contactName: 'Carlos Silva',
    state: 'BOT_IN_MENU',
    lastMessageAt: new Date(Date.now() - 300000),
    messages: [
      {
        id: 'msg-1',
        wamid: 'wamid.HBgLNTUxMTk4NzY1NDMyMRUCABEYEjA5ODc2NTQzMjEw',
        direction: 'INBOUND',
        type: 'TEXT',
        body: 'Olá! Gostaria de ver o catálogo de tênis',
        timestamp: new Date(Date.now() - 360000),
      },
      {
        id: 'msg-2',
        wamid: 'wamid.HBgLNTUxMTk4NzY1NDMyMRUCABEYEjEyMzQ1Njc4OTAw',
        direction: 'OUTBOUND',
        type: 'PRODUCT_LIST',
        body: 'Aqui está nossa coleção disponível no WhatsApp:',
        timestamp: new Date(Date.now() - 355000),
        payload: {
          catalogId: '123456789012345',
          products: ['SKU-TENIS-AZUL-42', 'SKU-CAMISA-PRETA-G'],
        },
      },
    ],
  },
];

const initialInstagramPosts: InstagramPostData[] = [
  {
    id: 'post-1',
    igUserId: '17841443995002822',
    mediaType: 'REELS',
    caption: 'Lançamento imperdível: Nova coleção de tênis running com tecnologia responsiva. Acesse o link da bio ou chame no WhatsApp!',
    mediaUrl: 'https://meta.3facil.com/uploads/reels-test-9-16.mp4',
    status: 'PUBLISHED',
    containerId: '17923485720194827',
    metaMediaId: '18029384756192834',
    publishedAt: new Date(Date.now() - 86400000),
    createdAt: new Date(Date.now() - 90000000),
  },
  {
    id: 'post-2',
    igUserId: '17841443995002822',
    mediaType: 'IMAGE',
    caption: 'Detalhes que fazem a diferença: Camisa Casual 100% Algodão. Toque na sacolinha para comprar direto no Instagram Shop 🛍️',
    mediaUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1080&q=80',
    status: 'SCHEDULED',
    scheduledFor: new Date(Date.now() + 86400000),
    createdAt: new Date(),
  },
];

class MemoryDatabase {
  products: ProductData[] = [...initialProducts];
  conversations: ConversationData[] = [...initialConversations];
  posts: InstagramPostData[] = [...initialInstagramPosts];
  credentials: MetaCredentialData[] = [];

  // Products
  async getProducts() {
    return [...this.products];
  }

  async getProductByRetailerId(retailerId: string) {
    return this.products.find((p) => p.retailerId === retailerId);
  }

  async upsertProduct(product: Partial<ProductData> & { retailerId: string; title: string; price: number }) {
    const existingIndex = this.products.findIndex((p) => p.retailerId === product.retailerId);
    const now = new Date();
    if (existingIndex >= 0) {
      this.products[existingIndex] = {
        ...this.products[existingIndex],
        ...product,
        updatedAt: now,
      } as ProductData;
      return this.products[existingIndex];
    } else {
      const newProd: ProductData = {
        id: `prod-${Date.now()}`,
        currency: 'BRL',
        availability: 'in stock',
        condition: 'new',
        url: `https://sualoja.com.br/produtos/${product.retailerId.toLowerCase()}`,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
        brand: 'MinhaMarca',
        category: 'Geral',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        ...product,
      } as ProductData;
      this.products.unshift(newProd);
      return newProd;
    }
  }

  async updateProductSyncStatus(retailerId: string, status: ProductData['syncStatus'], error?: string) {
    const prod = this.products.find((p) => p.retailerId === retailerId);
    if (prod) {
      prod.syncStatus = status;
      prod.lastSyncedAt = new Date();
      prod.syncError = error;
      prod.updatedAt = new Date();
    }
    return prod;
  }

  // Conversations & WhatsApp
  async getConversations() {
    return [...this.conversations];
  }

  async getConversationByWaId(waId: string) {
    return this.conversations.find((c) => c.waId === waId);
  }

  async addMessage(params: {
    waId: string;
    contactName?: string;
    wamid: string;
    direction: 'INBOUND' | 'OUTBOUND';
    type: string;
    body: string;
    payload?: any;
  }) {
    let conv = this.conversations.find((c) => c.waId === params.waId);
    const now = new Date();
    if (!conv) {
      conv = {
        id: `conv-${Date.now()}`,
        contactId: `ct-${params.waId}`,
        waId: params.waId,
        contactName: params.contactName || params.waId,
        state: 'BOT_ROUTING',
        lastMessageAt: now,
        messages: [],
      };
      this.conversations.unshift(conv);
    }

    if (conv.messages.some((m) => m.wamid === params.wamid)) {
      return conv;
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    conv.messages.push({
      id: `msg-${uniqueSuffix}`,
      wamid: params.wamid,
      direction: params.direction,
      type: params.type,
      body: params.body,
      timestamp: now,
      payload: params.payload,
    });
    conv.lastMessageAt = now;
    return conv;
  }

  async setConversationState(waId: string, state: ConversationData['state']) {
    const conv = this.conversations.find((c) => c.waId === waId);
    if (conv) {
      conv.state = state;
    }
    return conv;
  }

  // Instagram Posts
  async getPosts() {
    return [...this.posts];
  }

  async addPost(post: Omit<InstagramPostData, 'id' | 'createdAt'>) {
    const newPost: InstagramPostData = {
      id: `post-${Date.now()}`,
      createdAt: new Date(),
      ...post,
    };
    this.posts.unshift(newPost);
    return newPost;
  }

  async updatePost(id: string, updates: Partial<InstagramPostData>) {
    const index = this.posts.findIndex((p) => p.id === id);
    if (index >= 0) {
      this.posts[index] = { ...this.posts[index], ...updates };
      return this.posts[index];
    }
    return null;
  }

  async cancelCampaignPosts(campaignId: string) {
    let cancelledCount = 0;
    this.posts.forEach((p) => {
      if (p.campaignId === campaignId && p.status === 'SCHEDULED') {
        p.status = 'CANCELLED';
        cancelledCount++;
      }
    });
    return { cancelledCount };
  }

  async getPostsByCampaign(campaignId: string) {
    return this.posts.filter((p) => p.campaignId === campaignId || p.id.includes(campaignId));
  }

  async getFailedPostsByCampaign(campaignId: string) {
    return this.posts.filter(
      (p) => (p.campaignId === campaignId || p.id.includes(campaignId)) && p.status === 'FAILED'
    );
  }

  async resetPostForRetry(id: string, newMediaUrl?: string) {
    const post = this.posts.find((p) => p.id === id);
    if (!post) return null;

    post.status = 'SCHEDULED';
    post.errorCode = undefined;
    post.errorMessage = undefined;
    post.containerId = undefined;
    post.metaMediaId = undefined;
    if (newMediaUrl && newMediaUrl.trim()) {
      post.mediaUrl = newMediaUrl.trim();
    }
    return post;
  }

  // Meta Credentials Storage
  async saveCredential(data: Omit<MetaCredentialData, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    const existing = this.credentials.find((c) => c.channel === data.channel);
    if (existing) {
      Object.assign(existing, data, { updatedAt: now });
      return existing;
    }
    const newCred: MetaCredentialData = {
      id: `cred-${Date.now()}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.credentials.unshift(newCred);
    return newCred;
  }

  async getLatestCredential(channel: MetaCredentialData['channel']) {
    return this.credentials.find((c) => c.channel === channel && c.isValid) || null;
  }
}

export const db = new MemoryDatabase();
