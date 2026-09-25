import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  Instagram, 
  Video, 
  Image as ImageIcon, 
  Sparkles, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Send, 
  Calendar, 
  Upload, 
  CheckCircle2, 
  Film, 
  X,
  FileCheck,
  CalendarDays,
  Check,
  AlertTriangle,
  Lightbulb,
  Ban,
  Layers,
  ChevronDown,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { InstagramPost } from '../types.js';

interface InstagramPublisherProps {
  posts: InstagramPost[];
  onSchedulePost: (data: {
    mediaType: 'IMAGE' | 'REELS' | 'STORIES';
    caption: string;
    mediaUrl: string;
    scheduledFor?: string;
  }) => Promise<void>;
  onScheduleCampaign?: (data: {
    mediaType: 'IMAGE' | 'REELS' | 'STORIES';
    caption: string;
    mediaUrl: string;
    daysCount: number;
    schedules: Array<{ dayIndex: number; scheduledFor: string }>;
  }) => Promise<any>;
  onCancelCampaign?: (campaignId: string) => Promise<void>;
  isPublishing: boolean;
}

interface BatchDaySchedule {
  dayIndex: number;
  dateFormatted: string; // ex: 25/09/26
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  fullDateTime: string; // YYYY-MM-DDTHH:mm
  weekdayLabel: string; // sex., sáb., etc.
}

export const InstagramPublisher: React.FC<InstagramPublisherProps> = ({
  posts,
  onSchedulePost,
  onScheduleCampaign,
  onCancelCampaign,
  isPublishing,
}) => {
  const [mediaType, setMediaType] = useState<'IMAGE' | 'REELS' | 'STORIES'>('REELS');
  const [caption, setCaption] = useState('Lançamento exclusivo da semana! Tênis e vestuário com frete grátis para todo o Brasil. Toque na sacolinha para comprar no Instagram Shop! 👟🔥 #streetwear #lifestyle');
  const [mediaUrl, setMediaUrl] = useState('https://assets.mixkit.co/videos/preview/mixkit-athlete-putting-on-his-running-shoes-42359-large.mp4');
  
  // Período selecionado: 'IMMEDIATE' | '5_DAYS' | '10_DAYS' | '15_DAYS' | 'CUSTOM'
  const [schedulePeriod, setSchedulePeriod] = useState<'IMMEDIATE' | '5_DAYS' | '10_DAYS' | '15_DAYS' | 'CUSTOM'>('5_DAYS');
  const [scheduledDate, setScheduledDate] = useState('');
  
  // Lista de dias da campanha para ajuste manual antes de confirmar
  const [batchSchedules, setBatchSchedules] = useState<BatchDaySchedule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Controle de campanhas expandidas/recolhidas na tabela
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

  // Lista de horários ocupados vinda diretamente da rota dedicada GET /api/instagram/scheduled-times
  const [serverBusyTimes, setServerBusyTimes] = useState<string[]>([]);
  const [isLoadingBusyTimes, setIsLoadingBusyTimes] = useState(false);

  // Estados de Upload de Arquivo
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar os horários ocupados da API
  const fetchBusyTimes = useCallback(async () => {
    setIsLoadingBusyTimes(true);
    try {
      const res = await fetch('/api/instagram/scheduled-times');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.busyTimes)) {
          setServerBusyTimes(data.busyTimes);
        }
      }
    } catch {
      // Ignora silenciosamente
    } finally {
      setIsLoadingBusyTimes(false);
    }
  }, []);

  // Carregar os horários ocupados e inicializar com os 5 dias por padrão
  useEffect(() => {
    fetchBusyTimes();
  }, [fetchBusyTimes, posts]);

  // Inicializa o lote de 5 dias assim que os slots forem carregados se estiver vazio
  useEffect(() => {
    if (schedulePeriod === '5_DAYS' && batchSchedules.length === 0) {
      handleSelectPeriod('5_DAYS');
    }
  }, [schedulePeriod]);

  // Mapear horários (HH:mm) ocupados no banco de dados
  const scheduledTimeSlots = useMemo(() => {
    const slots = new Map<string, { dateFormatted: string; post?: InstagramPost }>();
    
    posts.forEach((p) => {
      if (['SCHEDULED', 'DRAFT'].includes(p.status) && p.scheduledFor) {
        const d = new Date(p.scheduledFor);
        const timeKey = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        slots.set(timeKey, {
          dateFormatted: d.toLocaleDateString('pt-BR'),
          post: p,
        });
      }
    });

    serverBusyTimes.forEach((timeStr) => {
      if (!slots.has(timeStr)) {
        slots.set(timeStr, {
          dateFormatted: 'post agendado',
        });
      }
    });

    return slots;
  }, [posts, serverBusyTimes]);

  // Extrair hora e minuto do input datetime-local atual (para caso CUSTOM)
  const currentTimeSelected = useMemo(() => {
    if (!scheduledDate) return null;
    const d = new Date(scheduledDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, [scheduledDate]);

  // Verificar se o horário selecionado colide no caso CUSTOM
  const hasTimeConflict = useMemo(() => {
    if (schedulePeriod !== 'CUSTOM' && schedulePeriod !== 'IMMEDIATE') {
      return null;
    }
    if (!currentTimeSelected) return null;
    if (scheduledTimeSlots.has(currentTimeSelected)) {
      return scheduledTimeSlots.get(currentTimeSelected);
    }
    return null;
  }, [schedulePeriod, currentTimeSelected, scheduledTimeSlots]);

  // Algoritmo para gerar uma lista de N horários exclusivos e livres
  const generateExclusiveTimesForBatch = useCallback((count: number): Array<{ h: number; m: number }> => {
    const preferredHours = [9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21];
    const preferredMinutes = [7, 14, 21, 28, 35, 42, 49, 56, 11, 23, 37, 48];
    const generated: Array<{ h: number; m: number }> = [];
    const usedInBatch = new Set<string>();

    for (let i = 0; i < count; i++) {
      let foundH = 10;
      let foundM = 15;
      let found = false;

      // Percorre horários buscando um que não esteja nem no banco nem no lote
      for (const h of preferredHours) {
        for (const m of preferredMinutes) {
          const testKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          if (!scheduledTimeSlots.has(testKey) && !usedInBatch.has(testKey)) {
            foundH = h;
            foundM = m;
            usedInBatch.add(testKey);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      // Fallback dinâmico se a lista preferida esgotar
      if (!found) {
        for (let h = 8; h <= 22; h++) {
          for (let m = 1; m < 60; m += 2) {
            const testKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (!scheduledTimeSlots.has(testKey) && !usedInBatch.has(testKey)) {
              foundH = h;
              foundM = m;
              usedInBatch.add(testKey);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      generated.push({ h: foundH, m: foundM });
    }

    return generated;
  }, [scheduledTimeSlots]);

  // Aplicar período pré-definido (5, 10, 15 dias): Gera lote com 1 post por dia começando amanhã
  const handleSelectPeriod = (period: 'IMMEDIATE' | '5_DAYS' | '10_DAYS' | '15_DAYS' | 'CUSTOM') => {
    setSchedulePeriod(period);
    setScheduleError(null);

    if (period === 'IMMEDIATE') {
      setScheduledDate('');
      setBatchSchedules([]);
      return;
    }

    if (period === 'CUSTOM') {
      setBatchSchedules([]);
      if (!scheduledDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(18, 20, 0, 0);
        const y = tomorrow.getFullYear();
        const mo = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const d = String(tomorrow.getDate()).padStart(2, '0');
        setScheduledDate(`${y}-${mo}-${d}T18:20`);
      }
      return;
    }

    // Para 5, 10 ou 15 dias: Monta a prévia com N dias consecutivos
    const daysCount = period === '5_DAYS' ? 5 : period === '10_DAYS' ? 10 : 15;
    const times = generateExclusiveTimesForBatch(daysCount);
    const newBatch: BatchDaySchedule[] = [];

    for (let i = 0; i < daysCount; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + (i + 1)); // Começando amanhã

      const { h, m } = times[i];
      targetDate.setHours(h, m, 0, 0);

      const y = targetDate.getFullYear();
      const mo = String(targetDate.getMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${mo}-${d}`;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      const day2Digits = String(targetDate.getDate()).padStart(2, '0');
      const month2Digits = String(targetDate.getMonth() + 1).padStart(2, '0');
      const year2Digits = String(targetDate.getFullYear()).slice(-2);
      const dateFormatted = `${day2Digits}/${month2Digits}/${year2Digits}`;
      const weekdayLabel = targetDate.toLocaleDateString('pt-BR', { weekday: 'short' });

      newBatch.push({
        dayIndex: i,
        dateFormatted,
        dateStr,
        timeStr,
        fullDateTime: `${dateStr}T${timeStr}`,
        weekdayLabel,
      });
    }

    setBatchSchedules(newBatch);
  };

  // Ajustar manualmente o horário de um dia específico do lote
  const handleUpdateBatchDayTime = (dayIndex: number, newTime: string) => {
    setScheduleError(null);
    setBatchSchedules((prev) =>
      prev.map((item) => {
        if (item.dayIndex !== dayIndex) return item;
        return {
          ...item,
          timeStr: newTime,
          fullDateTime: `${item.dateStr}T${newTime}`,
        };
      })
    );
  };

  // Controle de qual dia da lista está com a grade de horários aberta para seleção rápida
  const [activePickerDayIndex, setActivePickerDayIndex] = useState<number | null>(null);

  // Mapear erros inline específicos de cada linha da lista de dias (sem travar as outras)
  const batchItemErrors = useMemo(() => {
    const errors: Record<number, string> = {};
    if (batchSchedules.length === 0) return errors;

    const timeCounts = new Map<string, number[]>();
    batchSchedules.forEach((item) => {
      const list = timeCounts.get(item.timeStr) || [];
      list.push(item.dayIndex);
      timeCounts.set(item.timeStr, list);
    });

    batchSchedules.forEach((item) => {
      // 1. Conflito interno no lote (repetido com outro dia da lista)
      const daysWithSameTime = timeCounts.get(item.timeStr) || [];
      if (daysWithSameTime.length > 1) {
        const otherDays = daysWithSameTime.filter((d) => d !== item.dayIndex).map((d) => d + 1);
        errors[item.dayIndex] = `Horário repetido com o Dia ${otherDays.join(', ')}. Cada dia deve ter um horário único.`;
        return;
      }

      // 2. Conflito com post já agendado no banco de dados
      if (scheduledTimeSlots.has(item.timeStr)) {
        const conflict = scheduledTimeSlots.get(item.timeStr);
        errors[item.dayIndex] = `Horário ${item.timeStr} já ocupado por outro post agendado (${conflict?.dateFormatted || 'no sistema'}). Escolha outro.`;
        return;
      }
    });

    return errors;
  }, [batchSchedules, scheduledTimeSlots]);

  // Validação geral do lote para habilitar/desabilitar o botão de confirmar agendamento
  const batchConflicts = useMemo(() => {
    if (batchSchedules.length === 0) return { hasError: false, message: '' };
    const errorCount = Object.keys(batchItemErrors).length;
    if (errorCount > 0) {
      return {
        hasError: true,
        message: `Existem ${errorCount} ${errorCount === 1 ? 'dia' : 'dias'} com conflito de horário. Corrija os horários destacados em vermelho para confirmar o lote.`,
      };
    }
    return { hasError: false, message: '' };
  }, [batchSchedules, batchItemErrors]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      alert('Por favor, selecione um arquivo de imagem (JPEG/PNG) ou vídeo (MP4/MOV).');
      return;
    }

    if (isVideo) {
      setMediaType('REELS');
    } else {
      setMediaType('IMAGE');
    }

    setIsUploading(true);
    setUploadProgress(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Falha no upload do arquivo');
      }

      const data = await res.json();
      setMediaUrl(data.mediaUrl);
      setUploadedFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar mídia: ' + (err.message || 'Verifique o formato e tamanho'));
    } finally {
      setIsUploading(false);
      setUploadProgress(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const clearUploadedFile = () => {
    setUploadedFileName(null);
    setPreviewUrl(null);
    setMediaUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submissão do formulário: Suporta post avulso OU campanha em lote (5, 10, 15 dias)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);

    if (!mediaUrl) {
      alert('Por favor, faça upload de uma foto/vídeo ou insira uma URL.');
      return;
    }

    // Fluxo 1: Campanha em lote de 5, 10 ou 15 dias
    if (['5_DAYS', '10_DAYS', '15_DAYS'].includes(schedulePeriod)) {
      if (batchConflicts.hasError) {
        setScheduleError(batchConflicts.message);
        return;
      }

      if (batchSchedules.length === 0) {
        setScheduleError('Nenhum cronograma de dias foi gerado.');
        return;
      }

      setIsSubmitting(true);
      try {
        if (onScheduleCampaign) {
          await onScheduleCampaign({
            mediaType,
            caption,
            mediaUrl,
            daysCount: batchSchedules.length,
            schedules: batchSchedules.map((s) => ({
              dayIndex: s.dayIndex,
              scheduledFor: new Date(s.fullDateTime).toISOString(),
            })),
          });
        }
        setBatchSchedules([]);
        setSchedulePeriod('CUSTOM');
        setScheduledDate('');
      } catch (err: any) {
        setScheduleError(err.message || 'Erro ao criar campanha em lote.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Fluxo 2: Post individual ou imediato
    if (scheduledDate) {
      const targetTime = new Date(scheduledDate).getTime();
      if (isNaN(targetTime)) {
        setScheduleError('Data de agendamento inválida.');
        return;
      }
      if (targetTime <= Date.now()) {
        setScheduleError('Selecione uma data e horário no futuro.');
        return;
      }

      if (hasTimeConflict) {
        setScheduleError(
          `O horário ${currentTimeSelected} já está ocupado por outro post agendado (${hasTimeConflict.dateFormatted}). Escolha outro horário.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSchedulePost({
        mediaType,
        caption,
        mediaUrl,
        scheduledFor: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
      });
      setScheduledDate('');
      setScheduleError(null);
    } catch (err: any) {
      setScheduleError(err.message || 'Erro ao agendar publicação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Agrupamento de Posts por Campanha para a tabela
  const groupedCampaignData = useMemo(() => {
    const campaigns: Record<
      string,
      {
        campaignId: string;
        posts: InstagramPost[];
        startDate: Date | null;
        endDate: Date | null;
        activeScheduledCount: number;
      }
    > = {};
    const standAlonePosts: InstagramPost[] = [];

    posts.forEach((p) => {
      if (p.campaignId) {
        if (!campaigns[p.campaignId]) {
          campaigns[p.campaignId] = {
            campaignId: p.campaignId,
            posts: [],
            startDate: null,
            endDate: null,
            activeScheduledCount: 0,
          };
        }
        campaigns[p.campaignId].posts.push(p);

        if (p.status === 'SCHEDULED') {
          campaigns[p.campaignId].activeScheduledCount++;
        }

        if (p.scheduledFor) {
          const d = new Date(p.scheduledFor);
          if (!campaigns[p.campaignId].startDate || d < campaigns[p.campaignId].startDate!) {
            campaigns[p.campaignId].startDate = d;
          }
          if (!campaigns[p.campaignId].endDate || d > campaigns[p.campaignId].endDate!) {
            campaigns[p.campaignId].endDate = d;
          }
        }
      } else {
        standAlonePosts.push(p);
      }
    });

    // Ordenar posts de cada campanha por data agendada
    Object.values(campaigns).forEach((c) => {
      c.posts.sort((a, b) => {
        const da = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
        const db = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
        return da - db;
      });
    });

    return {
      campaignsList: Object.values(campaigns),
      standAlonePosts,
    };
  }, [posts]);

  const toggleCampaignCollapse = (campaignId: string) => {
    setExpandedCampaigns((prev) => ({
      ...prev,
      [campaignId]: !prev[campaignId],
    }));
  };

  return (
    <div className="space-y-6" id="instagram-publisher-container">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Instagram Content & Reels Publisher</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-800">
              Graph API v21.0
            </span>
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Faça upload direto de fotos e vídeos MP4 ou agende campanhas diárias (5, 10 ou 15 posts) com horários orgânicos exclusivos.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          <Clock className="h-4 w-4 text-fuchsia-600" />
          <span>Limite Meta: <strong>100 posts / 24h</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Post Form */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center space-x-2">
            <Instagram className="h-4 w-4 text-fuchsia-600" />
            <span>Criar Publicação ou Campanha Diária</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Media Type Selector */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Tipo de Conteúdo</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMediaType('REELS')}
                  className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center space-x-1.5 transition ${
                    mediaType === 'REELS'
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Reels (9:16)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('IMAGE')}
                  className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center space-x-1.5 transition ${
                    mediaType === 'IMAGE'
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Feed (Foto)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('STORIES')}
                  className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center space-x-1.5 transition ${
                    mediaType === 'STORIES'
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Stories</span>
                </button>
              </div>
            </div>

            {/* Direct File Upload Area */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Upload de Foto ou Vídeo (Direto do seu Computador / Celular)
              </label>
              
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {!uploadedFileName && !previewUrl ? (
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-fuchsia-500 bg-fuchsia-50/50'
                      : 'border-slate-300 hover:border-fuchsia-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="h-10 w-10 rounded-full bg-fuchsia-50 flex items-center justify-center text-fuchsia-600">
                      {isUploading ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-xs">
                        {isUploading ? 'Fazendo upload da mídia...' : 'Clique para selecionar foto/vídeo ou arraste aqui'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Formatos: MP4 (Reels) ou JPEG/PNG (Feed). Até 100MB.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      {mediaType === 'REELS' ? <Film className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-900 text-xs truncate">
                          {uploadedFileName || 'Arquivo Carregado'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono block truncate">
                        {mediaUrl}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearUploadedFile}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                    title="Remover arquivo e escolher outro"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* URL da Mídia */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                URL Pública da Mídia (Acessível pela Meta Graph API)
              </label>
              <input
                type="url"
                required
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://meta.3facil.com/uploads/..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-fuchsia-500"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Legenda da Publicação & Tags de Loja</label>
              <textarea
                rows={3}
                required
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escreva a legenda com hashtags e chamada para ação..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-fuchsia-500 text-xs"
              />
            </div>

            {/* SELETOR DE PERÍODO & CRIAÇÃO EM LOTE */}
            <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="font-semibold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <CalendarDays className="h-4 w-4 text-fuchsia-600" />
                    <span>Seletor de Período & Programação em Lote</span>
                  </span>
                  <span className="text-[10px] text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 font-medium px-2 py-0.5 rounded-full">
                    {scheduledTimeSlots.size} horários bloqueados no sistema
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ao escolher um período, <strong>um post será criado para cada dia consecutivo a partir de amanhã</strong>, com horário exclusivo que não se repete.
                </p>
              </div>

              {/* Botões do Seletor de Período */}
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('5_DAYS')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                      schedulePeriod === '5_DAYS'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs font-bold ring-1 ring-fuchsia-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5 text-fuchsia-600" />
                    <span>Próximos 5 dias</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('10_DAYS')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                      schedulePeriod === '10_DAYS'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs font-bold ring-1 ring-fuchsia-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5 text-fuchsia-600" />
                    <span>Próximos 10 dias</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('15_DAYS')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                      schedulePeriod === '15_DAYS'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs font-bold ring-1 ring-fuchsia-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5 text-fuchsia-600" />
                    <span>Próximos 15 dias</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('CUSTOM')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === 'CUSTOM'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs font-bold ring-1 ring-fuchsia-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>Data Manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('IMMEDIATE')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === 'IMMEDIATE'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs font-bold ring-1 ring-fuchsia-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Send className="h-3 w-3" />
                    <span>Imediato</span>
                  </button>
                </div>
              </div>

              {/* LISTA SUBSTITUTA: UMA LINHA PARA CADA DIA DO PERÍODO SELECIONADO */}
              {['5_DAYS', '10_DAYS', '15_DAYS'].includes(schedulePeriod) && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 text-fuchsia-600" />
                      <span>
                        Cronograma da Campanha ({batchSchedules.length} posts em {batchSchedules.length} dias consecutivos):
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Horários já sugeridos automaticamente e editáveis
                    </span>
                  </div>

                  <div className="space-y-2">
                    {batchSchedules.map((schedule) => {
                      const itemError = batchItemErrors[schedule.dayIndex];
                      const isPickerOpen = activePickerDayIndex === schedule.dayIndex;

                      return (
                        <div
                          key={schedule.dayIndex}
                          className={`p-3 rounded-xl border transition ${
                            itemError
                              ? 'bg-red-50/70 border-red-300 ring-1 ring-red-200'
                              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            {/* Data Fixa e Inalterável */}
                            <div className="flex items-center space-x-3">
                              <span className="w-6 h-6 rounded-full bg-fuchsia-100 text-fuchsia-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                {schedule.dayIndex + 1}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono font-bold text-slate-900 text-xs">
                                    {schedule.dateFormatted}
                                  </span>
                                  <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {schedule.weekdayLabel}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                  {schedule.dayIndex === 0 ? 'Amanhã' : `${schedule.dayIndex + 1}º dia da sequência`}
                                </span>
                              </div>
                            </div>

                            {/* Campo de Horário Editável + Atalho para Grade */}
                            <div className="flex items-center space-x-2">
                              <div className="relative flex items-center">
                                <Clock className="h-3.5 w-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                                <input
                                  type="time"
                                  required
                                  value={schedule.timeStr}
                                  onChange={(e) =>
                                    handleUpdateBatchDayTime(schedule.dayIndex, e.target.value)
                                  }
                                  className={`pl-7 pr-2 py-1.5 border rounded-lg font-mono text-xs focus:ring-1 bg-white ${
                                    itemError
                                      ? 'border-red-400 text-red-900 focus:ring-red-500'
                                      : 'border-slate-300 text-slate-900 focus:ring-fuchsia-500 font-semibold'
                                  }`}
                                />
                              </div>

                              {/* Botão para abrir a grade de horários deste dia */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActivePickerDayIndex(isPickerOpen ? null : schedule.dayIndex)
                                }
                                className={`px-2 py-1.5 text-[10px] font-semibold rounded-lg border transition flex items-center space-x-1 ${
                                  isPickerOpen
                                    ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                                title="Ver grade de horários disponíveis/ocupados"
                              >
                                <span>Grade</span>
                                <ChevronDown className={`h-3 w-3 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {itemError ? (
                                <Ban className="h-4 w-4 text-red-500 shrink-0" title={itemError} />
                              ) : (
                                <Check className="h-4 w-4 text-emerald-600 shrink-0" title="Horário livre e exclusivo" />
                              )}
                            </div>
                          </div>

                          {/* Mensagem de Erro Inline na Linha Específica */}
                          {itemError && (
                            <div className="mt-2 pt-2 border-t border-red-200 flex items-center space-x-1.5 text-[11px] text-red-700 font-medium">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                              <span>{itemError}</span>
                            </div>
                          )}

                          {/* Grade de Horários "Disponível/Ocupado" aberta para este dia */}
                          {isPickerOpen && (
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 bg-slate-50 p-2.5 rounded-lg animate-in fade-in duration-150">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-slate-700">
                                  Selecione um horário comercial livre para o dia {schedule.dateFormatted}:
                                </span>
                                <span className="text-[9px] text-slate-400 flex items-center space-x-2">
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2 h-2 rounded bg-emerald-100 border border-emerald-300"></span>
                                    <span>Livre</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2 h-2 rounded bg-slate-100 border border-slate-300"></span>
                                    <span>Ocupado</span>
                                  </span>
                                </span>
                              </div>

                              <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded border border-slate-200">
                                {commercialTimeSlots.map((slot) => {
                                  // Considera ocupado se está no banco OU se já foi escolhido em outro dia da lista
                                  const isUsedInOtherDay = batchSchedules.some(
                                    (other) => other.dayIndex !== schedule.dayIndex && other.timeStr === slot.time
                                  );
                                  const isOccupied = slot.isBusy || isUsedInOtherDay;
                                  const isSelected = schedule.timeStr === slot.time;

                                  return (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      disabled={isOccupied}
                                      onClick={() => {
                                        handleUpdateBatchDayTime(schedule.dayIndex, slot.time);
                                        setActivePickerDayIndex(null);
                                      }}
                                      title={
                                        isOccupied
                                          ? `Horário ${slot.time} ocupado`
                                          : `Escolher ${slot.time}`
                                      }
                                      className={`px-1 py-1 rounded text-[10px] font-mono transition text-center ${
                                        isSelected
                                          ? 'bg-fuchsia-600 text-white font-bold ring-2 ring-fuchsia-300'
                                          : isOccupied
                                          ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed line-through'
                                          : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 shadow-2xs font-medium'
                                      }`}
                                    >
                                      {slot.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumo da Validação do Lote */}
                  {batchConflicts.hasError ? (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{batchConflicts.message}</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Excelente! Todos os <strong>{batchSchedules.length} horários</strong> estão válidos, livres e sem nenhuma colisão.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* POST ÚNICO (DATA MANUAL): VOLTA AO COMPORTAMENTO DE CAMPO ÚNICO */}
              {schedulePeriod === 'CUSTOM' && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Data & Horário Específico (Post Único):
                    </label>
                  </div>

                  <input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => {
                      setScheduledDate(e.target.value);
                      setScheduleError(null);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-1 text-xs bg-white ${
                      hasTimeConflict
                        ? 'border-red-400 focus:ring-red-500 text-red-900 bg-red-50/30'
                        : scheduledDate
                        ? 'border-emerald-300 focus:ring-emerald-500'
                        : 'border-slate-300 focus:ring-fuchsia-500'
                    }`}
                  />

                  {hasTimeConflict && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px]">
                      Conflito: o horário {currentTimeSelected} já está em uso na programação ({hasTimeConflict.dateFormatted}).
                    </div>
                  )}
                </div>
              )}

              {/* MODO IMEDIATO */}
              {schedulePeriod === 'IMMEDIATE' && (
                <div className="p-3 bg-fuchsia-50/60 border border-fuchsia-200 rounded-lg text-xs text-fuchsia-900 flex items-center space-x-2">
                  <Send className="h-4 w-4 text-fuchsia-600 shrink-0" />
                  <span>
                    A publicação será processada e disparada <strong>imediatamente</strong> na Meta Graph API sem agendamento.
                  </span>
                </div>
              )}

              {scheduleError && (
                <p className="text-[11px] text-red-600 font-medium flex items-center space-x-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{scheduleError}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isPublishing ||
                isUploading ||
                (['5_DAYS', '10_DAYS', '15_DAYS'].includes(schedulePeriod) && batchConflicts.hasError) ||
                (schedulePeriod === 'CUSTOM' && (Boolean(hasTimeConflict) || !scheduledDate))
              }
              className="w-full py-2.5 px-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Enfileirando posts na BullMQ...</span>
                </>
              ) : ['5_DAYS', '10_DAYS', '15_DAYS'].includes(schedulePeriod) ? (
                <>
                  <Layers className="h-4 w-4" />
                  <span>
                    Confirmar Agendamento de {batchSchedules.length} dias
                  </span>
                </>
              ) : schedulePeriod === 'CUSTOM' ? (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>Agendar Publicação ({scheduledDate ? new Date(scheduledDate).toLocaleDateString('pt-BR') : ''})</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Publicar Agora no Instagram</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preview da Mídia & Dicas */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-slate-200">
            <h4 className="font-bold text-white text-xs mb-3 flex items-center space-x-2">
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
              <span>Preview da Mídia</span>
            </h4>

            {previewUrl || mediaUrl ? (
              <div className="rounded-lg overflow-hidden border border-slate-700 bg-black flex items-center justify-center max-h-[300px]">
                {mediaType === 'REELS' ? (
                  <video
                    src={previewUrl || mediaUrl}
                    controls
                    className="max-h-[300px] w-auto rounded object-contain"
                  />
                ) : (
                  <img
                    src={previewUrl || mediaUrl}
                    alt="Preview"
                    className="max-h-[300px] w-auto rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="h-44 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs">
                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                <span>Nenhuma mídia selecionada</span>
              </div>
            )}
          </div>

          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
            <div className="flex items-center space-x-2 font-bold mb-1 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Como funcionam as Campanhas no Instagram</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1 leading-relaxed text-[11px]">
              <li><strong>Lote Diário:</strong> 1 post por dia programado para os próximos 5, 10 ou 15 dias.</li>
              <li><strong>Horário Exclusivo:</strong> O algoritmo não repete nenhum minuto em nenhum dia da campanha.</li>
              <li><strong>Cancelamento em 1 Clique:</strong> Toda a campanha pode ser cancelada de uma vez na tabela abaixo.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Posts Table & Campanhas Agrupadas */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Publicações & Campanhas Agendadas</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Campanhas agrupadas por lote com controle de cancelamento em massa.
            </p>
          </div>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {posts.length} posts registrados
          </span>
        </div>

        {/* 1. SEÇÃO DE CAMPANHAS AGRUPADAS */}
        {groupedCampaignData.campaignsList.length > 0 && (
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="h-3.5 w-3.5 text-fuchsia-600" />
              <span>Campanhas em Lote ({groupedCampaignData.campaignsList.length})</span>
            </h4>

            <div className="space-y-2">
              {groupedCampaignData.campaignsList.map((campaign) => {
                const isExpanded = expandedCampaigns[campaign.campaignId] ?? true;
                return (
                  <div
                    key={campaign.campaignId}
                    className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs"
                  >
                    {/* Header da Campanha */}
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div
                        onClick={() => toggleCampaignCollapse(campaign.campaignId)}
                        className="flex items-center space-x-2.5 cursor-pointer select-none"
                      >
                        <button type="button" className="text-slate-400 hover:text-slate-600">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">
                              Campanha de {campaign.posts.length} Dias
                            </span>
                            <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                              {campaign.campaignId.slice(0, 8)}...
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {campaign.startDate?.toLocaleDateString('pt-BR')} até{' '}
                            {campaign.endDate?.toLocaleDateString('pt-BR')} • {campaign.activeScheduledCount} posts agendados ativos
                          </span>
                        </div>
                      </div>

                      {/* Botão de Cancelar Campanha Inteira */}
                      <div className="flex items-center space-x-2">
                        {campaign.activeScheduledCount > 0 && onCancelCampaign && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja realmente cancelar todos os posts agendados desta campanha?`)) {
                                onCancelCampaign(campaign.campaignId);
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center space-x-1.5 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Cancelar Campanha Inteira</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Posts da Campanha (Recolhível) */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <tbody className="divide-y divide-slate-100">
                            {campaign.posts.map((post, idx) => (
                              <tr key={post.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400 w-12">
                                  Dia {idx + 1}
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-800">
                                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">
                                    {post.mediaType}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-600 max-w-[200px] truncate">
                                  {post.caption}
                                </td>
                                <td className="py-2.5 px-4 text-slate-700">
                                  {post.scheduledFor ? (
                                    <div className="flex items-center space-x-1.5">
                                      <Clock className="h-3 w-3 text-fuchsia-600" />
                                      <span className="font-bold text-slate-900">
                                        {new Date(post.scheduledFor).toLocaleTimeString('pt-BR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        ({new Date(post.scheduledFor).toLocaleDateString('pt-BR')})
                                      </span>
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-2.5 px-4">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      post.status === 'PUBLISHED'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : post.status === 'SCHEDULED'
                                        ? 'bg-blue-50 text-blue-700'
                                        : post.status === 'CANCELLED'
                                        ? 'bg-slate-100 text-slate-500 line-through'
                                        : 'bg-red-50 text-red-700'
                                    }`}
                                  >
                                    {post.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. TABELA GERAL DE TODOS OS POSTS */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200/60">
              <tr>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Mídia / Prévia</th>
                <th className="py-3 px-4">Legenda</th>
                <th className="py-3 px-4">Agendado / Publicado</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Campanha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                      {post.mediaType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <a
                      href={post.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fuchsia-600 hover:underline max-w-[150px] truncate block font-mono text-[11px]"
                    >
                      Ver mídia
                    </a>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-[280px] truncate">
                    {post.caption}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {post.scheduledFor ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 text-[11px] flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-fuchsia-600 inline" />
                          <span>{new Date(post.scheduledFor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(post.scheduledFor).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ) : post.publishedAt ? (
                      <span className="text-slate-600">
                        {new Date(post.publishedAt).toLocaleString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Imediato</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        post.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : post.status === 'SCHEDULED'
                          ? 'bg-blue-50 text-blue-700'
                          : post.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-500 line-through'
                          : post.status === 'FAILED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700 animate-pulse'
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {post.campaignId ? (
                      <span className="px-1.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded text-[10px] font-semibold">
                        {post.campaignId.slice(0, 8)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

