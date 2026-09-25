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
  Ban
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
  isPublishing: boolean;
}

export const InstagramPublisher: React.FC<InstagramPublisherProps> = ({
  posts,
  onSchedulePost,
  isPublishing,
}) => {
  const [mediaType, setMediaType] = useState<'IMAGE' | 'REELS' | 'STORIES'>('REELS');
  const [caption, setCaption] = useState('Lançamento exclusivo da semana! Tênis e vestuário com frete grátis para todo o Brasil. Toque na sacolinha para comprar no Instagram Shop! 👟🔥 #streetwear #lifestyle');
  const [mediaUrl, setMediaUrl] = useState('https://assets.mixkit.co/videos/preview/mixkit-athlete-putting-on-his-running-shoes-42359-large.mp4');
  
  // Período selecionado: 'IMMEDIATE' | '5_DAYS' | '10_DAYS' | '15_DAYS' | 'CUSTOM'
  const [schedulePeriod, setSchedulePeriod] = useState<'IMMEDIATE' | '5_DAYS' | '10_DAYS' | '15_DAYS' | 'CUSTOM'>('CUSTOM');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

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
      // Ignora silenciosamente fallback local
    } finally {
      setIsLoadingBusyTimes(false);
    }
  }, []);

  useEffect(() => {
    fetchBusyTimes();
  }, [fetchBusyTimes, posts]);

  // Mapear horários (HH:mm) ocupados (combina servidor e posts recebidos por props)
  const scheduledTimeSlots = useMemo(() => {
    const slots = new Map<string, { dateFormatted: string; post?: InstagramPost }>();
    
    // Alimenta pelos posts da prop
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

    // Garante que qualquer horário retornado pela rota GET /api/instagram/scheduled-times esteja registrado
    serverBusyTimes.forEach((timeStr) => {
      if (!slots.has(timeStr)) {
        slots.set(timeStr, {
          dateFormatted: 'post agendado',
        });
      }
    });

    return slots;
  }, [posts, serverBusyTimes]);

  // Extrair hora e minuto do input datetime-local atual
  const currentTimeSelected = useMemo(() => {
    if (!scheduledDate) return null;
    const d = new Date(scheduledDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, [scheduledDate]);

  // Verificar se o horário selecionado colide com algum outro post já agendado
  const hasTimeConflict = useMemo(() => {
    if (!currentTimeSelected) return null;
    if (scheduledTimeSlots.has(currentTimeSelected)) {
      return scheduledTimeSlots.get(currentTimeSelected);
    }
    return null;
  }, [currentTimeSelected, scheduledTimeSlots]);

  // Grade de horários de engajamento comercial (9h às 21h) para seleção visual
  const commercialTimeSlots = useMemo(() => {
    const slots: { time: string; label: string; isBusy: boolean }[] = [];
    const baseHours = [9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21];
    const minutes = [0, 15, 30, 45];

    for (const h of baseHours) {
      for (const m of minutes) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const isBusy = scheduledTimeSlots.has(timeStr);
        slots.push({
          time: timeStr,
          label: timeStr,
          isBusy,
        });
      }
    }
    return slots;
  }, [scheduledTimeSlots]);

  // Algoritmo de Recomendação: busca um horário livre com alta taxa de engajamento
  const getRecommendedFreeTime = useCallback(() => {
    const candidateSlots = [
      { h: 10, m: 15 },
      { h: 12, m: 30 },
      { h: 15, m: 45 },
      { h: 18, m: 20 },
      { h: 19, m: 10 },
      { h: 20, m: 35 },
      { h: 9, m: 45 },
      { h: 11, m: 20 },
      { h: 16, m: 15 },
      { h: 17, m: 50 },
      { h: 21, m: 15 },
    ];

    for (const slot of candidateSlots) {
      const timeKey = `${String(slot.h).padStart(2, '0')}:${String(slot.m).padStart(2, '0')}`;
      if (!scheduledTimeSlots.has(timeKey)) {
        return slot;
      }
    }

    // Se todos os padrão estiverem ocupados, tenta com minutos dinâmicos
    for (let h = 9; h <= 21; h++) {
      for (let m = 7; m < 60; m += 9) {
        const timeKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (!scheduledTimeSlots.has(timeKey)) {
          return { h, m };
        }
      }
    }

    return { h: 18, m: 27 };
  }, [scheduledTimeSlots]);

  // Aplicar período pré-definido (5, 10, 15 dias ou Imediato) com horário livre sugerido
  const handleSelectPeriod = (period: 'IMMEDIATE' | '5_DAYS' | '10_DAYS' | '15_DAYS' | 'CUSTOM') => {
    setSchedulePeriod(period);
    setScheduleError(null);

    if (period === 'IMMEDIATE') {
      setScheduledDate('');
      return;
    }

    let daysToAdd = 5;
    if (period === '10_DAYS') daysToAdd = 10;
    if (period === '15_DAYS') daysToAdd = 15;
    if (period === 'CUSTOM') {
      // Se não tinha data, inicializa para amanhã com horário recomendado
      if (!scheduledDate) {
        daysToAdd = 1;
      } else {
        return;
      }
    }

    const target = new Date();
    target.setDate(target.getDate() + daysToAdd);

    const rec = getRecommendedFreeTime();
    target.setHours(rec.h, rec.m, 0, 0);

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');

    setScheduledDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  // Definir apenas a hora:minuto mantendo a data já selecionada
  const handleSelectTimeSlot = (timeStr: string) => {
    if (scheduledTimeSlots.has(timeStr)) {
      return; // Bloqueado, já ocupado
    }

    const base = scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 86400000);
    const [h, m] = timeStr.split(':').map(Number);
    base.setHours(h, m, 0, 0);

    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    const hours = String(base.getHours()).padStart(2, '0');
    const minutes = String(base.getMinutes()).padStart(2, '0');

    setScheduledDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    setScheduleError(null);
  };

  // Botão para desemparelhar / desviar o horário com 1 clique (+3 ou +7 min)
  const handleShiftTimeByMinutes = (minutesToAdd: number) => {
    if (!scheduledDate) return;
    const current = new Date(scheduledDate);
    current.setMinutes(current.getMinutes() + minutesToAdd);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const hours = String(current.getHours()).padStart(2, '0');
    const minutes = String(current.getMinutes()).padStart(2, '0');

    setScheduledDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    setScheduleError(null);
  };

  // Sugerir automaticamente um horário livre de engajamento
  const handleAutoSuggestTime = () => {
    const rec = getRecommendedFreeTime();
    const base = scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 86400000 * 5);
    base.setHours(rec.h, rec.m, 0, 0);

    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    const hours = String(base.getHours()).padStart(2, '0');
    const minutes = String(base.getMinutes()).padStart(2, '0');

    setScheduledDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    setScheduleError(null);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Detecta se é vídeo ou imagem
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);

    if (!mediaUrl) {
      alert('Por favor, faça upload de uma foto/vídeo ou insira uma URL.');
      return;
    }

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

      // Validação do horário idêntico
      if (hasTimeConflict) {
        setScheduleError(
          `O horário ${currentTimeSelected} já está ocupado por outro post agendado (${hasTimeConflict.dateFormatted}). Para evitar penalidades no algoritmo do Instagram, altere os minutos (ex: use os botões rápidos de desvio).`
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
            Faça upload direto de fotos e vídeos MP4 ou agende publicações no feed e Reels da sua conta comercial.
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
            <span>Criar ou Agendar Nova Publicação</span>
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

            {/* URL da Mídia (com opção manual ou preenchida pelo upload) */}
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
              <p className="text-[10px] text-slate-400 mt-1">
                Ao fazer o upload acima, o link oficial HTTPS é gerado automaticamente.
              </p>
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

            {/* Schedule Option */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="font-semibold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <CalendarDays className="h-4 w-4 text-fuchsia-600" />
                    <span>Programação Inteligente & Anti-Repetição</span>
                  </span>
                  <span className="text-[10px] text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 font-medium px-2 py-0.5 rounded-full">
                    {scheduledTimeSlots.size} horários já bloqueados
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  1. Escolha o período pré-definido. 2. Selecione ou receba a recomendação de um horário livre (HH:mm).
                </p>
              </div>

              {/* 1. SELETOR DE PERÍODO */}
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  Período de Publicação:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('IMMEDIATE')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === 'IMMEDIATE' && !scheduledDate
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Send className="h-3 w-3" />
                    <span>Imediato</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('5_DAYS')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === '5_DAYS'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Próximos 5 dias</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('10_DAYS')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === '10_DAYS'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Próximos 10 dias</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('15_DAYS')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === '15_DAYS'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Próximos 15 dias</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod('CUSTOM')}
                    className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1 transition ${
                      schedulePeriod === 'CUSTOM'
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>Data Manual</span>
                  </button>
                </div>
              </div>

              {/* Data e Horário Selecionados */}
              {(scheduledDate || schedulePeriod !== 'IMMEDIATE') && (
                <div className="space-y-3 pt-1 border-t border-slate-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Data & Horário Específico:
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleAutoSuggestTime}
                        className="text-[10px] font-semibold text-fuchsia-700 hover:text-fuchsia-900 flex items-center space-x-1 bg-fuchsia-50 border border-fuchsia-200 px-2 py-0.5 rounded transition"
                      >
                        <Lightbulb className="h-3 w-3 text-amber-500" />
                        <span>Sugerir Horário Livre</span>
                      </button>
                      {scheduledDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setScheduledDate('');
                            setSchedulePeriod('IMMEDIATE');
                            setScheduleError(null);
                          }}
                          className="text-[10px] text-slate-400 hover:text-red-500 font-medium"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input Datetime Local */}
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => {
                        setScheduledDate(e.target.value);
                        setSchedulePeriod('CUSTOM');
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
                  </div>

                  {/* 2. SELETOR DE HORÁRIOS COM SLOTS OCUPADOS DESABILITADOS */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>Grade de Horários Comerciais (Janela 9h - 21h):</span>
                      </span>
                      <span className="text-[9px] text-slate-400 flex items-center space-x-2">
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded bg-emerald-100 border border-emerald-300"></span>
                          <span>Disponível</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded bg-slate-100 border border-slate-200 text-slate-400"></span>
                          <span>Ocupado (Bloqueado)</span>
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded border border-slate-100">
                      {commercialTimeSlots.map((slot) => {
                        const isSelected = currentTimeSelected === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={slot.isBusy}
                            onClick={() => handleSelectTimeSlot(slot.time)}
                            title={
                              slot.isBusy
                                ? `Horário ${slot.time} já ocupado por outro post agendado`
                                : `Selecionar ${slot.time}`
                            }
                            className={`px-1.5 py-1 rounded text-[10px] font-mono font-medium transition text-center flex items-center justify-center space-x-0.5 ${
                              isSelected
                                ? 'bg-fuchsia-600 text-white font-bold ring-2 ring-fuchsia-300'
                                : slot.isBusy
                                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed line-through'
                                : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 shadow-2xs'
                            }`}
                          >
                            {slot.isBusy && <Ban className="h-2.5 w-2.5 text-slate-300 inline mr-0.5" />}
                            <span>{slot.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Alerta de Conflito de Horário (Quando tenta usar o mesmo horário HH:mm) */}
                  {hasTimeConflict && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] space-y-1.5">
                      <div className="flex items-start space-x-1.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                        <span>Conflito: o horário {currentTimeSelected} já está em uso na programação!</span>
                      </div>
                      <p className="text-[10px] text-red-700 leading-relaxed pl-5">
                        O post agendado para <strong>{hasTimeConflict.dateFormatted}</strong> já ocupa o horário {currentTimeSelected}. O Instagram não permite horários duplicados na programação.
                      </p>
                      <div className="flex items-center space-x-2 pl-5 pt-0.5">
                        <span className="text-[10px] font-medium text-slate-600">Desemparelhar agora:</span>
                        <button
                          type="button"
                          onClick={() => handleShiftTimeByMinutes(7)}
                          className="px-2 py-0.5 rounded bg-white border border-red-300 text-red-700 hover:bg-red-100 font-bold text-[10px] transition"
                        >
                          +7 min
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftTimeByMinutes(13)}
                          className="px-2 py-0.5 rounded bg-white border border-red-300 text-red-700 hover:bg-red-100 font-bold text-[10px] transition"
                        >
                          +13 min
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoSuggestTime}
                          className="px-2 py-0.5 rounded bg-fuchsia-600 text-white font-bold text-[10px] hover:bg-fuchsia-700 transition"
                        >
                          Horário Sugerido
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback quando o horário é válido e único */}
                  {scheduledDate && !hasTimeConflict && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Horário <strong>{currentTimeSelected}</strong> aprovado e exclusivo! Livre para agendamento.
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700">
                        {new Date(scheduledDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}

                  {/* Mensagem de Erro Geral de Agendamento */}
                  {scheduleError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center space-x-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{scheduleError}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Rodapé Informativo / Boas Práticas do Algoritmo */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                <span>💡 <strong>Regra de Algoritmo:</strong> Cada post agendado deve ter um minuto único (HH:mm).</span>
                <span>{scheduledTimeSlots.size} horários exclusivos</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isPublishing || isUploading || Boolean(hasTimeConflict)}
              className="w-full py-2.5 px-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Enfileirando na BullMQ...</span>
                </>
              ) : hasTimeConflict ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-200" />
                  <span>Altere o horário ({currentTimeSelected}) para agendar</span>
                </>
              ) : scheduledDate ? (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>Agendar Publicação ({new Date(scheduledDate).toLocaleDateString('pt-BR')})</span>
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
          {/* Card de Preview */}
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
              <span>Dicas de Formato para Instagram</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1 leading-relaxed text-[11px]">
              <li><strong>Reels:</strong> Resolução recomendada 1080x1920 (9:16 vertical), duração até 15 minutos em MP4.</li>
              <li><strong>Feed:</strong> Imagens JPEG ou PNG de alta resolução (1080x1080 quadrado ou 1080x1350 vertical).</li>
              <li><strong>Áudio:</strong> O arquivo de vídeo do Reels deve ter áudio embutido (AAC).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Publicações & Agendamentos</h3>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {posts.length} posts registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200/60">
              <tr>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Mídia / Prévia</th>
                <th className="py-3 px-4">Legenda</th>
                <th className="py-3 px-4">Agendado / Publicado</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Meta ID</th>
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
                          : post.status === 'FAILED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700 animate-pulse'
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {post.metaMediaId || post.containerId || '—'}
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
