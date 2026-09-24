import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

/**
 * Responde perguntas abertas dos clientes no WhatsApp usando Gemini
 * Mantém a resposta concisa, comercial e sempre orienta a usar os botões ou falar com atendente se necessário.
 */
export async function generateBotResponse(
  userQuestion: string,
  catalogContext: string
): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return 'Olá! No momento estamos operando com nosso menu rápido. Digite *cardapio* ou *catalogo* para ver nossos produtos ou *atendente* para falar com nossa equipe!';
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Pergunta do cliente: "${userQuestion}"`,
      config: {
        systemInstruction: `Você é a assistente virtual oficial de atendimento e vendas da plataforma 3facil (Meta Omnichannel Hub).
Seu objetivo é tirar dúvidas rápidas sobre produtos, pedidos, prazos e funcionamento.
Regras:
1. Seja sempre cordial, profissional, concisa (máximo 2 a 3 frases curtas) no tom do WhatsApp.
2. Não invente produtos que não estejam no catálogo.
3. Se o cliente pedir para falar com atendente humano ou expressar insatisfação grave, sugira que digite "atendente".
4. Se o assunto for compra, sugira que ele veja nosso catálogo tocando no menu.

Contexto dos produtos disponíveis:
${catalogContext}`,
        temperature: 0.7,
      },
    });

    return response.text || 'Olá! Como posso ajudar você hoje? Digite *catalogo* ou escolha uma opção do menu.';
  } catch (error) {
    console.error('[Gemini Service] Erro ao gerar resposta do bot:', error);
    return 'Obrigado por nos contatar! Como posso ajudar você hoje? Digite *catalogo* para ver nossos itens ou *atendente* para suporte humano.';
  }
}
