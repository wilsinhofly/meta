import React, { useState, useRef } from 'react';
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
  FileCheck
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

  // Estados de Upload de Arquivo
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!mediaUrl) {
      alert('Por favor, faça upload de uma foto/vídeo ou insira uma URL.');
      return;
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
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Agendar para Data Futura (Opcional)</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-fuchsia-500 text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Deixe em branco para disparar o pipeline de publicação imediatamente.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isPublishing || isUploading}
              className="w-full py-2.5 px-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Enfileirando na BullMQ...</span>
                </>
              ) : scheduledDate ? (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>Agendar Publicação</span>
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
                    {post.scheduledFor
                      ? new Date(post.scheduledFor).toLocaleString('pt-BR')
                      : post.publishedAt
                      ? new Date(post.publishedAt).toLocaleString('pt-BR')
                      : 'Imediato'}
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
