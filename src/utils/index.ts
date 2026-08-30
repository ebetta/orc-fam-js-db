

interface Tag {
  id: string;
  name: string;
  parent_tag_id: string | null;
  [key: string]: any;
}

export function getTagPath(tagId: string | null | undefined, allTags: Tag[]): string {
  if (!tagId) return '';
  const tag = allTags.find(t => t.id === tagId);
  if (!tag) return '';
  if (tag.parent_tag_id) {
    const parentPath = getTagPath(tag.parent_tag_id, allTags);
    return parentPath ? `${parentPath} / ${tag.name}` : tag.name;
  }
  return tag.name;
}

export function getChildTagIds(parentId: string, allTags: Tag[]): Set<string> {
  const ids = new Set<string>();
  const findChildren = (id: string) => {
    allTags.forEach(tag => {
      if (tag.parent_tag_id === id) {
        ids.add(tag.id);
        findChildren(tag.id);
      }
    });
  };
  findChildren(parentId);
  return ids;
}

export function isLeafTag(tag: Tag, allTags: Tag[]): boolean {
  return !allTags.some(t => t.parent_tag_id === tag.id);
}

export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Gera as opções de ano para seletores de mês/ano, sempre incluindo o ano informado
// (relevante ao editar orçamentos antigos fora da janela padrão).
export function getYearOptions(includeYear?: number): number[] {
  const base = new Date().getFullYear();
  const years = new Set<number>();
  for (let y = base - 10; y <= base + 3; y++) years.add(y);
  if (includeYear) years.add(includeYear);
  return Array.from(years).sort((a, b) => a - b);
}