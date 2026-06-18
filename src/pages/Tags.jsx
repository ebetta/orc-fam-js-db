
import { useState, useEffect, useRef } from "react";
import { api, auth } from "@/lib/api";
import { useSidebarActions } from "./Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

import TagForm from "../components/tags/TagForm";
import TagsList from "../components/tags/TagsList";

import { Tag, ChevronDown, ChevronUp } from "lucide-react";

function TagsHeroCard({ tagsCount, onExpandAll, onCollapseAll }) {
  return (
    <div
      className="relative overflow-hidden p-8 rounded-2xl text-white shadow-lg"
      style={{ background: "linear-gradient(135deg, #4648d4 0%, #6063ee 60%, #8b5cf6 100%)" }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/15 rounded-xl">
              <Tag className="w-6 h-6" />
            </div>
            <h2 className="font-headline-lg text-headline-lg">Categorias</h2>
          </div>
          <p className="text-white/60 font-body-sm mt-1">
            {tagsCount} tag{tagsCount !== 1 ? "s" : ""} cadastrada{tagsCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={onExpandAll}
            variant="secondary"
            size="sm"
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            <ChevronDown className="w-4 h-4" />
            Expandir
          </Button>
          <Button
            onClick={onCollapseAll}
            variant="secondary"
            size="sm"
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            <ChevronUp className="w-4 h-4" />
            Colapsar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TagsPage() {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [expandedTags, setExpandedTags] = useState(new Set());
  const { toast } = useToast();
  const { registerNewTagHandler, unregisterNewTagHandler } = useSidebarActions();
  const openNewTagRef = useRef(null);

  useEffect(() => {
    loadTags();
  }, []);

  openNewTagRef.current = () => {
    setEditingTag(null);
    setShowForm(true);
  };

  useEffect(() => {
    registerNewTagHandler(() => openNewTagRef.current?.());
    return () => unregisterNewTagHandler();
  }, [registerNewTagHandler, unregisterNewTagHandler]);

  useEffect(() => {
    if (tags.length > 0 && expandedTags.size === 0) {
      const rootTags = tags.filter(tag => !tag.parent_tag_id);
      setExpandedTags(new Set(rootTags.map(tag => tag.id)));
    }
  }, [tags]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.get("tags", { _sort: "name", _order: "asc" });
      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error("Erro ao carregar tags:", error.message);
      toast({
        title: "Erro ao carregar tags",
        description: "Ocorreu um problema ao buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleFormSubmit = async (tagData) => {
    const isEditing = !!editingTag?.id;
    try {
      const { data: { user } } = await auth.getUser();
      if (!user && !isEditing) throw new Error("Usuário não autenticado para criar tag.");

      if (isEditing) {
        const dataToUpdate = {
          ...tagData,
          parent_tag_id: tagData.parent_tag_id !== undefined ? tagData.parent_tag_id : editingTag.parent_tag_id,
        };

        const { error: updateError } = await api.put("tags", editingTag.id, dataToUpdate);
        if (updateError) throw updateError;

        if (dataToUpdate.color && dataToUpdate.color !== editingTag.color) {
          const childrenTags = tags.filter(tag => tag.parent_tag_id === editingTag.id);
          if (childrenTags.length > 0) {
            const updatePromises = childrenTags.map(child =>
              api.put("tags", child.id, { color: dataToUpdate.color })
            );
            const results = await Promise.all(updatePromises);
            results.forEach(result => { if (result.error) console.error("Erro ao atualizar cor do filho:", result.error); });

            toast({
              title: "Cores atualizadas!",
              description: `A cor da tag "${dataToUpdate.name}" e suas ${childrenTags.length} tag(s) filha(s) foram atualizadas.`,
              className: "bg-blue-100 text-blue-800 border-blue-300",
            });
          } else {
            toast({
              title: "Tag Atualizada!",
              description: `A tag "${dataToUpdate.name}" foi atualizada com sucesso.`,
              className: "bg-green-100 text-green-800 border-green-300",
            });
          }
        } else {
          toast({
            title: "Tag Atualizada!",
            description: `A tag "${dataToUpdate.name}" foi atualizada com sucesso.`,
            className: "bg-green-100 text-green-800 border-green-300",
          });
        }
      } else {
        let finalTagData = {
          ...tagData,
          parent_tag_id: tagData.parent_tag_id,
          user_id: user.id
        };

        if (finalTagData.parent_tag_id) {
          const parentTag = tags.find(t => t.id === finalTagData.parent_tag_id);
          if (parentTag && parentTag.color && !finalTagData.color) {
            finalTagData.color = parentTag.color;
          }
        }

        const { error: insertError } = await api.post("tags", finalTagData);
        if (insertError) throw insertError;
        toast({
          title: "Tag Criada!",
          description: `A tag "${finalTagData.name}" foi criada com sucesso.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      }
      setShowForm(false);
      setEditingTag(null);
      loadTags();
    } catch (error) {
      console.error("Erro ao salvar tag:", error.message);
      toast({
        title: "Erro ao salvar tag",
        description: "Não foi possível salvar a tag. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setShowForm(true);
  };

  const handleDeleteTag = async (tagId) => {
    const hasChildren = tags.some(tag => tag.parent_tag_id === tagId);
    if (hasChildren) {
      toast({
        title: "Não é possível excluir",
        description: "Esta tag possui tags filhas. Remova ou reatribua as tags filhas primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tagToDelete = tags.find(t => t.id === tagId);
      const { error } = await api.delete("tags", tagId);
      if (error) throw error;
      toast({
        title: "Tag Excluída!",
        description: `A tag "${tagToDelete?.name}" foi excluída com sucesso.`,
      });
      loadTags();
    } catch (error) {
      console.error("Erro ao excluir tag:", error.message);
      toast({
        title: "Erro ao excluir tag",
        description: "Ocorreu um problema ao tentar excluir a tag.",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTag(null);
  };

  const handleToggleTag = (tagId) => {
    setExpandedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    const rootTags = tags.filter(tag => !tag.parent_tag_id);
    setExpandedTags(new Set(rootTags.map(tag => tag.id)));
  };

  const handleCollapseAll = () => {
    setExpandedTags(new Set());
  };

  const buildTagTree = (tagsList) => {
    if (!tagsList || tagsList.length === 0) return [];

    const tagMap = {};
    const tree = [];

    tagsList.forEach(tag => {
      tagMap[tag.id] = { ...tag, children: [] };
    });

    tagsList.forEach(tag => {
      if (tag.parent_tag_id && tagMap[tag.parent_tag_id]) {
        tagMap[tag.parent_tag_id].children.push(tagMap[tag.id]);
      } else {
        tree.push(tagMap[tag.id]);
      }
    });

    const sortChildren = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
        node.children.forEach(sortChildren);
      }
    };

    tree.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    tree.forEach(sortChildren);

    return tree;
  };

  const tagTree = buildTagTree(tags);

  return (
    <div className="v2-theme font-body-md text-body-md text-on-background bg-background min-h-screen">
      <div className="p-6 lg:p-10 space-y-8">

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <TagsHeroCard
            tagsCount={tags.length}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <TagsList
            tags={tagTree}
            isLoading={isLoading}
            onEditTag={handleEditTag}
            onDeleteTag={handleDeleteTag}
            expandedTags={expandedTags}
            onToggleTag={handleToggleTag}
          />
        </motion.div>

      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex justify-center items-center p-4 overflow-auto"
            onClick={handleCancelForm}
          >
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <TagForm
                tag={editingTag}
                allTags={tags}
                onSave={handleFormSubmit}
                onCancel={handleCancelForm}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
