import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { FileSpreadsheet, Link2 } from "lucide-react";

import ImportHeader from "../components/imports/ImportHeader";
import ImportResultsModal from "../components/imports/ImportResultsModal";
import FileImportTab from "../components/imports/FileImportTab";
import PluggySyncTab from "../components/imports/PluggySyncTab";

export default function ImportPage() {
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const resetActiveTab = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const { data: accountsRaw, error: accountsError } = await api.get('accounts');
      if (accountsError) throw accountsError;
      const accountsData = accountsRaw.filter(a => a.is_active !== false);

      const { data: tagsRaw, error: tagsError } = await api.get('tags');
      if (tagsError) throw tagsError;
      const tagsData = tagsRaw.filter(t => t.is_active !== false);

      setAccounts(accountsData);
      setTags(tagsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  // Chamado pelas duas abas ao final do processamento; o "reset" opcional limpa
  // o formulário da aba de arquivo quando o modal é fechado.
  const handleFinish = (results, reset = null) => {
    resetActiveTab.current = reset;
    setImportResults(results);
    setShowResults(true);
  };

  const handleTagUpdate = async (transactionId, tagId) => {
    try {
      const { error } = await api.put('transactions', transactionId, { tag_id: tagId });

      if (error) throw error;

      // Update local state to reflect the change immediately
      setImportResults(prevResults => {
        const newDetails = prevResults.details.map(detail => {
          if (detail.transactionId === transactionId) {
            return { ...detail, tagId: tagId };
          }
          return detail;
        });
        return { ...prevResults, details: newDetails };
      });

    } catch (error) {
      console.error("Erro ao atualizar tag:", error);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ImportHeader />
      </motion.div>

      <Tabs defaultValue="file" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Arquivo (CSV)
          </TabsTrigger>
          <TabsTrigger value="pluggy" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Open Finance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <FileImportTab accounts={accounts} tags={tags} onFinish={handleFinish} />
        </TabsContent>

        <TabsContent value="pluggy">
          <PluggySyncTab accounts={accounts} onFinish={handleFinish} />
        </TabsContent>
      </Tabs>

      {/* Modal de Resultados */}
      <ImportResultsModal
        results={importResults}
        isOpen={showResults}
        tags={tags}
        onTagChange={handleTagUpdate}
        onClose={() => {
          setShowResults(false);
          if (resetActiveTab.current) {
            resetActiveTab.current();
            resetActiveTab.current = null;
          }
        }}
      />
    </div>
  );
}
