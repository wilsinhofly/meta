import React, { useState, useRef, useMemo } from 'react';
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
  AlertTriangle
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
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Estados de Upload de Arquivo
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapear horários (HH:mm) já ocupados em publicações agendadas
  const scheduledTimeSlots = useMemo(() => {
    const slots = new Map<string, { dateFormatted: string; post: InstagramPost }>();
    posts.forEach((p) => {
      if (p.status === 'SCHEDULED' && p.scheduledFor) {
        const d = new Date(p.scheduledFor);
        const timeKey = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        slots.set(timeKey, {
          dateFormatted: d.toLocaleDateString('pt-BR'),
          post: p,
        });
      }
    });
    return slots;
  }, [posts]);

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

  // Helper para adicionar dias rapidamente com recomendação de horário aleatorizado/orgânico
  const handleQuickScheduleDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);

    // Sugere horários estratégicos com minutos quebrados (algoritmo orgânico do Instagram)
    const organicMinutes = [7, 13, 21, 29, 37, 44, 52];
    const preferredHours = [10, 12, 15, 18, 19, 21];

    let foundHour = 18;
    let foundMinute = 27;

    // Tenta encontrar uma combinação de hora:minuto que não esteja ocupada
    let attempts = 0;
    while (attempts < 50) {
      const h = preferredHours[Math.floor(Math.random() * preferredHours.length)];
      const m = organicMinutes[Math.floor(Math.random() * organicMinutes.length)];
      const testKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!scheduledTimeSlots.has(testKey)) {
        foundHour = h;
        foundMinute = m;
        break;
      }
      attempts++;
    }

    target.setHours(foundHour, foundMinute, 0, 0);

    // Formatar para o formato aceito por datetime-local: YYYY-MM-DDTHH:mm
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');

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
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="font-semibold text-slate-800 flex items-center space-x-1.5">
                    <CalendarDays className="h-4 w-4 text-fuchsia-600" />
                    <span>Programação Inteligente de Postagens</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Defina datas futuras ou use os atalhos com horários orgânicos anti-repetição.
                  </p>
                </div>

                {/* Atalhos rápidos para 5, 10 e 15 dias */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Programar:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickScheduleDays(5)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-fuchsia-200 bg-white hover:bg-fuchsia-50 text-fuchsia-700 transition shadow-2xs"
                  >
                    +5 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickScheduleDays(10)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-fuchsia-200 bg-white hover:bg-fuchsia-50 text-fuchsia-700 transition shadow-2xs"
                  >
                    +10 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickScheduleDays(15)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-fuchsia-200 bg-white hover:bg-fuchsia-50 text-fuchsia-700 transition shadow-2xs"
                  >
                    +15 Dias
                  </button>
                </div>
              </div>

              {/* Input Datetime Local */}
              <div className="relative">
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
                {scheduledDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledDate('');
                      setScheduleError(null);
                    }}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-[10px] font-medium"
                    title="Publicar imediatamente"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Alerta de Conflito de Horário (Quando tenta usar o mesmo horário HH:mm) */}
              {hasTimeConflict && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] space-y-1.5">
                  <div className="flex items-start space-x-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                    <span>Conflito: o horário {currentTimeSelected} já está em uso na programação!</span>
                  </div>
                  <p className="text-[10px] text-red-700 leading-relaxed pl-5">
                    O post agendado para <strong>{hasTimeConflict.dateFormatted}</strong> já ocupa o horário {currentTimeSelected}. O Instagram pode considerar postagens em horários idênticos como comportamento automatizado repetitivo.
                  </p>
                  <div className="flex items-center space-x-2 pl-5 pt-0.5">
                    <span className="text-[10px] font-medium text-slate-600">Recomendação rápida:</span>
                    <button
                      type="button"
                      onClick={() => handleShiftTimeByMinutes(7)}
                      className="px-2 py-0.5 rounded bg-white border border-red-300 text-red-700 hover:bg-red-100 font-bold text-[10px] transition"
                    >
                      Mudar para +7 min
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShiftTimeByMinutes(13)}
                      className="px-2 py-0.5 rounded bg-white border border-red-300 text-red-700 hover:bg-red-100 font-bold text-[10px] transition"
                    >
                      Mudar para +13 min
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback quando o horário é válido e único */}
              {scheduledDate && !hasTimeConflict && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center space-x-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Horário <strong>{currentTimeSelected}</strong> aprovado e exclusivo! Nenhum outro post programado para esse minuto.
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

              {/* Rodapé Informativo / Boas Práticas do Algoritmo */}
              <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                <span>💡 <strong>Dica da Meta:</strong> Varie sempre os minutos (ex: 10:07, 10:14) para engajamento orgânico.</span>
                <span>{scheduledTimeSlots.size} horários reservados</span>
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
