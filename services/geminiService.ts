import { GoogleGenAI } from "@google/genai";
import { Product, StockMovement } from "../types";

export const generateInventoryAnalysis = async (products: Product[], movements: StockMovement[]) => {
  // Guard clause for missing API key
  if (!process.env.API_KEY) {
    console.warn("API Key is missing for Gemini");
    return "Erro: Chave de API não configurada. Por favor, verifique as configurações do ambiente.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare a summarized context to save tokens
  const lowStock = products.filter(p => p.qty <= p.minQty).map(p => p.name);
  const stockValue = products.reduce((acc, p) => acc + (p.qty * p.costPrice), 0);
  const potentialProfit = products.reduce((acc, p) => acc + (p.qty * (p.sellPrice - p.costPrice)), 0);
  
  // Simple analysis of recent movements (last 10)
  const recentMoves = movements.slice(0, 20).map(m => `${m.type === 'in' ? 'Entrada' : 'Saída'}: ${m.qty}x ProductID:${m.productId}`);

  const prompt = `
    Você é um consultor especialista em varejo para pequenos mercados brasileiros.
    Analise os dados abaixo e forneça 3 sugestões táticas e curtas (máximo 2 frases cada) para melhorar a rentabilidade ou gestão.
    Use formatação Markdown simples.
    
    Dados:
    - Produtos com estoque baixo/crítico: ${lowStock.join(', ') || 'Nenhum'}
    - Valor total em estoque (Custo): R$ ${stockValue.toFixed(2)}
    - Lucro potencial estimado: R$ ${potentialProfit.toFixed(2)}
    - Movimentações recentes (amostra): ${JSON.stringify(recentMoves)}
    
    Responda em Português do Brasil com tom profissional e direto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Não foi possível gerar a análise no momento. Tente novamente mais tarde.";
  }
};
