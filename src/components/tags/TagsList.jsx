
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, MoreVertical, ChevronDown, ChevronRight, Tag as TagIconDefault, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Função para obter o ícone dinamicamente de forma segura
const getDynamicIcon = (iconNameString) => {
  // 1. Se o nome for inválido ou vazio, retorna o ícone padrão.
  if (typeof iconNameString !== 'string' || !iconNameString.trim()) {
    return TagIconDefault;
  }
  
  const name = iconNameString.trim();
  
  // Adiciona validação extra para caracteres inválidos para o nome de um ícone, como '*'.
  // Ícones Lucide geralmente usam nomes PascalCase ou kebab-case com caracteres alfanuméricos e hífens.
  if (!/^[A-Za-z0-9-]+$/.test(name)) {
      return TagIconDefault;
  }
  
  // 2. Tenta encontrar um ícone com o nome exato (PascalCase, ex: "Home" ou "ArrowUpRight")
  // Usamos Object.prototype.hasOwnProperty.call para segurança
  if (Object.prototype.hasOwnProperty.call(LucideIcons, name)) {
      const IconComponent = LucideIcons[name];
      // Valida se o que foi encontrado é de fato um componente de ícone renderizável
      if (IconComponent && (typeof IconComponent === 'object' || typeof IconComponent === 'function')) {
          return IconComponent;
      }
  }

  // 3. Se não encontrou, tenta converter de kebab-case para PascalCase (ex: "arrow-up-right" -> "ArrowUpRight")
  const pascalCaseName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
    
  if (Object.prototype.hasOwnProperty.call(LucideIcons, pascalCaseName)) {
      const IconComponent = LucideIcons[pascalCaseName];
      if (IconComponent && (typeof IconComponent === 'object' || typeof IconComponent === 'function')) {
          return IconComponent;
      }
  }

  // 4. Se nenhuma das tentativas funcionou, retorna o ícone padrão
  return TagIconDefault;
};

const TagRow = ({ tag, level = 0, onEditTag, onDeleteTag, allTags, isExpanded, onToggle }) => {
  const IconComponent = getDynamicIcon(tag.icon);
  const parentTag = tag.parent_tag_id ? allTags.find(t => t.id === tag.parent_tag_id) : null;

  const handleRowClick = (e) => {
    // Não executar se o clique foi nos botões de ação ou acordeão
    if (e.target.closest('.action-button') || e.target.closest('.accordion-button')) {
      return;
    }
    onEditTag(tag);
  };

  return (
    <>
      <TableRow 
        className={`hover:bg-surface-container-low cursor-pointer transition-colors ${tag.is_active === false ? 'opacity-60' : ''}`}
        onClick={handleRowClick}
      >
        <TableCell style={{ paddingLeft: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-3">
            {tag.children && tag.children.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 accordion-button" 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(tag.id);
                }}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            )}
            <div 
              className="w-5 h-5 rounded-md flex items-center justify-center mr-1 shrink-0 p-0.5"
              style={{ backgroundColor: tag.color || '#ccc' }}
            >
              <IconComponent className="w-full h-full text-white" />
            </div>
            <span className="font-medium text-on-background">{tag.name}</span>
            {tag.is_active === false && (
              <Badge variant="outline" className="text-xs">Inativa</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="font-body-sm text-body-sm text-on-surface-variant">
          {parentTag ? parentTag.name : <span className="text-outline/60">-</span>}
        </TableCell>
        <TableCell className="font-body-sm text-body-sm text-on-surface-variant capitalize">
          {tag.tag_type === "both" ? "Ambos" : tag.tag_type === "expense" ? "Despesa" : "Receita"}
        </TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 action-button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTag(tag.id);
            }}
            title="Excluir tag"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && tag.children && tag.children.length > 0 && (
        tag.children.map(child => (
          <TagRow
            key={child.id}
            tag={child}
            level={level + 1}
            onEditTag={onEditTag}
            onDeleteTag={onDeleteTag}
            allTags={allTags}
            isExpanded={true} // Filhas sempre expandidas quando o pai está expandido
            onToggle={() => {}} // Filhas não têm toggle próprio
          />
        ))
      )}
    </>
  );
};

export default function TagsList({ tags, isLoading, onEditTag, onDeleteTag, expandedTags, onToggleTag }) {
  // Precisamos de todas as tags para encontrar o nome da tag pai
  const flattenTags = (tagTree) => {
    let flat = [];
    function recurse(nodes) {
      nodes.forEach(node => {
        const { children, ...rest } = node;
        flat.push(rest);
        if (children && children.length > 0) {
          recurse(children);
        }
      });
    }
    recurse(tagTree);
    return flat;
  };
  const allTagsFlat = flattenTags(tags);

  if (isLoading) {
    return (
      <Card className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="bg-surface-container-low border-b border-outline-variant">
          <CardTitle className="flex items-center gap-2 text-headline-sm font-headline-sm text-on-background">
            <TagIconDefault className="w-5 h-5 text-secondary" />
            Lista de Categorias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-label-md font-label-md text-on-surface-variant">Nome</TableHead>
                <TableHead className="text-label-md font-label-md text-on-surface-variant">Categoria Pai</TableHead>
                <TableHead className="text-label-md font-label-md text-on-surface-variant">Tipo</TableHead>
                <TableHead className="text-right text-label-md font-label-md text-on-surface-variant">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map(i => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (tags.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm"
      >
        <TagIconDefault className="w-16 h-16 text-outline/40 mx-auto mb-6" />
        <h3 className="font-headline-sm text-headline-sm text-on-background mb-2">
          Nenhuma tag cadastrada
        </h3>
        <p className="text-on-surface-variant font-body-md">
          Comece criando sua primeira tag para organizar suas finanças.
        </p>
      </motion.div>
    );
  }

  return (
    <Card className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="bg-surface-container-low border-b border-outline-variant">
        <CardTitle className="flex items-center gap-2 text-headline-sm font-headline-sm text-on-background">
          <TagIconDefault className="w-5 h-5 text-secondary" />
          Lista de Categorias
          <span className="text-sm font-normal text-on-surface-variant ml-2">
            (Clique na linha para editar)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 text-label-md font-label-md text-on-surface-variant">Nome</TableHead>
              <TableHead className="text-label-md font-label-md text-on-surface-variant">Categoria Pai</TableHead>
              <TableHead className="text-label-md font-label-md text-on-surface-variant">Tipo</TableHead>
              <TableHead className="text-right pr-4 text-label-md font-label-md text-on-surface-variant">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {tags.map(tag => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  onEditTag={onEditTag}
                  onDeleteTag={onDeleteTag}
                  allTags={allTagsFlat}
                  isExpanded={expandedTags.has(tag.id)}
                  onToggle={onToggleTag}
                />
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
