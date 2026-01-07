import { GoogleGenAI } from "@google/genai";
import { Product, StockMovement, Sale } from "../types";

export const generateInventoryAnalysis = async (products: Product[], movements: StockMovement[], sales: Sale[]) => {
  // Guard clause for missing API key
  if (!process.env.API_KEY) {
    console.warn("API Key is missing for Gemini");
    return "Erro: Chave de API não configurada. Por favor, verifique as configurações do ambiente.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Calculate Sales Velocity (Last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const salesMap = new Map<string, number>(); // ProductID -> Qty Sold
  
  sales.forEach(sale => {
    if (new Date(sale.date) >= thirtyDaysAgo) {
        sale.items.forEach(item => {
            const current = salesMap.get(item.productId) || 0;
            salesMap.set(item.productId, current + item.qty);
        });
    }
  });

  // 2. Categorize Products
  const criticalStock: string[] = [];
  const topSellers: string[] = [];
  const deadStock: string[] = []; // High stock, no sales
  const overstockCandidate: string[] = [];

  const totalPortfolioValue = products.reduce((acc, p) => acc + (p.qty * p.costPrice), 0);

  // Helper to sort by sales
  const productsWithSales = products.map(p => ({
      ...p,
      soldQty: salesMap.get(p.id) || 0
  })).sort((a, b) => b.soldQty - a.soldQty);

  // Identify Top Sellers (Top 5)
  topSellers.push(...productsWithSales.slice(0, 5).map(p => `${p.name} (${p.soldQty} un. vendidas)`));

  productsWithSales.forEach(p => {
      // Critical: Low Stock AND High Velocity (sold more than current stock in last 30 days)
      if (p.qty <= p.minQty) {
          criticalStock.push(`${p.name} (Atual: ${p.qty}, Min: ${p.minQty})`);
      }
      
      // Dead Stock: Stock > 5 units AND 0 sales in 30 days
      if (p.qty > 5 && p.soldQty === 0) {
          deadStock.push(`${p.name} (Estoque: ${p.qty}, Valor parado: R$ ${(p.qty * p.costPrice).toFixed(2)})`);
      }

      // Overstock: Stock > 3x sold quantity (if sold > 0)
      if (p.soldQty > 0 && p.qty > (p.soldQty * 3)) {
          overstockCandidate.push(p.name);
      }
  });

  const prompt = `
    Atue como um Consultor de Inteligência de Negócios Sênior para um mercado varejista.
    Analise os dados de inventário e vendas abaixo para gerar recomendações estratégicas.

    **Resumo do Cenário (Últimos 30 dias):**
    - Valor Total em Estoque (Custo): R$ ${totalPortfolioValue.toFixed(2)}
    - Produtos Mais Vendidos (Carro-chefe): ${topSellers.join(', ') || 'Sem dados suficientes'}
    - Estoque Crítico (Baixo Nível): ${criticalStock.join(', ') || 'Nenhum'}
    - Estoque Parado (Sem vendas): ${deadStock.slice(0, 10).join(', ')} ${deadStock.length > 10 ? `...e mais ${deadStock.length - 10} itens` : ''}

    **Sua Tarefa:**
    Forneça 3 recomendações estratégicas curtas e acionáveis, focadas em:
    1. **Reposicão Inteligente:** O que priorizar na compra (baseado no que vende muito e está acabando).
    2. **Liberação de Caixa:** Sugestão de promoção para itens parados (Dead Stock).
    3. **Ajuste de Mix:** Uma observação sobre o equilíbrio do estoque.

    **Formatação:**
    - Use Markdown.
    - Seja direto e use emojis para facilitar a leitura.
    - Não use introduções genéricas como "Com base nos dados". Vá direto ao ponto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Não foi possível gerar a análise no momento. Verifique sua conexão ou tente novamente mais tarde.";
  }
};