// Heurística de categorização automática usada tanto pela importação de arquivo
// (browser) quanto pela sincronização do Pluggy (server.js). Módulo puro, sem
// React e sem alias "@/", para poder ser importado dos dois lados.

const commonMatches = {
  'supermercado': ['supermercado', 'mercado', 'alimentação'],
  'combustível': ['posto', 'combustível', 'gasolina', 'álcool', 'diesel'],
  'farmácia': ['farmácia', 'drogaria', 'medicamento'],
  'restaurante': ['restaurante', 'lanchonete', 'fast food', 'delivery'],
  'transporte': ['uber', 'taxi', '99', 'transporte', 'ônibus'],
  'banco': ['taxa', 'tarifa', 'anuidade', 'juros', 'banco'],
  'salário': ['salário', 'salario', 'vencimento', 'pagamento']
};

/**
 * Encontra a tag que melhor casa com a descrição da transação.
 * @param {string} description descrição da transação
 * @param {Array<{id: string, name: string}>} tags tags disponíveis do usuário
 * @returns {string|null} id da tag, ou null se nenhuma casar
 */
export function findMatchingTag(description, tags) {
  if (!description || !tags || tags.length === 0) return null;

  const descLower = description.toLowerCase();

  for (const tag of tags) {
    const tagNameLower = tag.name.toLowerCase();

    if (descLower.includes(tagNameLower)) {
      return tag.id;
    }

    const keywords = commonMatches[tagNameLower];
    if (keywords && keywords.some(keyword => descLower.includes(keyword))) {
      return tag.id;
    }
  }

  return null;
}
