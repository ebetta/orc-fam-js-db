import React, { useState, useEffect } from 'react';
import { api } from "@/lib/api";

// Cache em memória para cotações já buscadas na sessão atual
const memoryCache = new Map(); // General cache
const historicalRateCache = new Map(); // Cache specific for historical rates

// Function to get exchange rate for a specific date or the closest earlier date
export const getHistoricalExchangeRate = async (fromCurrency, targetDate, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return 1;
  if (!targetDate) {
    console.warn('getHistoricalExchangeRate: targetDate is required. Falling back to 1.');
    return 1;
  }

  const formattedTargetDate = typeof targetDate === 'string' ? targetDate.split('T')[0] : targetDate.toISOString().split('T')[0];
  const cacheKey = `${fromCurrency}_${toCurrency}_${formattedTargetDate}`;

  if (historicalRateCache.has(cacheKey)) {
    return historicalRateCache.get(cacheKey);
  }

  try {
    const { data: allRates, error } = await api.get('exchange_rates');
    
    const filteredRates = allRates?.filter(r => r.from_currency === fromCurrency && r.to_currency === toCurrency && r.rate_date <= formattedTargetDate)
                                  .sort((a, b) => new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime());
    const data = filteredRates?.[0];

    if (error) {
      console.error(`Erro ao buscar cotação histórica ${fromCurrency}->${toCurrency} para data ${formattedTargetDate}:`, error.message);
      return 1; // Fallback in case of error
    }

    if (data && data.rate) {
      console.log(`Cotação histórica encontrada para ${fromCurrency}->${toCurrency} em ${data.rate_date} (solicitado ${formattedTargetDate}): ${data.rate}`);
      historicalRateCache.set(cacheKey, data.rate);
      return data.rate;
    } else {
      console.warn(`Nenhuma cotação histórica encontrada para ${fromCurrency}->${toCurrency} até ${formattedTargetDate}. Verifique se há taxas cadastradas para datas anteriores ou igual à solicitada. Usando taxa 1.`);
      // Cache the fact that no rate was found to avoid repeated lookups for the same missing rate
      historicalRateCache.set(cacheKey, 1);
      return 1; // Fallback if no rate is found
    }
  } catch (err) {
    console.error(`Erro inesperado em getHistoricalExchangeRate para ${fromCurrency}->${toCurrency} data ${formattedTargetDate}:`, err.message);
    return 1; // Fallback
  }
};


export const getCurrencyExchangeRate = async (fromCurrency, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return 1;

  const cacheKey = `${fromCurrency}_${toCurrency}_latest`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    const { data: allRates, error } = await api.get('exchange_rates');

    if (error) {
      console.error(`Erro ao buscar cotação ${fromCurrency}->${toCurrency}:`, error.message);
      return 1;
    }

    const latestRate = allRates
      ?.filter(r => r.from_currency === fromCurrency && r.to_currency === toCurrency)
      .sort((a, b) => new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime())?.[0];

    if (latestRate) {
      const rate = parseFloat(latestRate.rate);
      if (!isNaN(rate)) {
        memoryCache.set(cacheKey, rate);
        return rate;
      }
    }

    console.warn(`Nenhuma cotação encontrada para ${fromCurrency}->${toCurrency}.`);
    memoryCache.set(cacheKey, 1);
    return 1;

  } catch (error) {
    console.error(`Erro ao buscar cotação ${fromCurrency}->${toCurrency}:`, error.message);
    return 1;
  }
};

// This function will now use getHistoricalExchangeRate when a targetDate is provided
export const convertCurrency = async (amount, fromCurrency, toCurrency = 'BRL', targetDate = null) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (fromCurrency === toCurrency) return numericAmount;

  if (typeof numericAmount !== 'number' || isNaN(numericAmount)) {
    return 0;
  }

  let rate;
  if (targetDate) {
    rate = await getHistoricalExchangeRate(fromCurrency, targetDate, toCurrency);
  } else {
    rate = await getCurrencyExchangeRate(fromCurrency, toCurrency);
  }

  return numericAmount * rate;
};

export const formatCurrencyWithSymbol = (amount, currency = 'BRL') => {
  const currencyMap = {
    'BRL': { locale: 'pt-BR', currency: 'BRL' },
    'USD': { locale: 'en-US', currency: 'USD' },
    'EUR': { locale: 'de-DE', currency: 'EUR' },
    'GBP': { locale: 'en-GB', currency: 'GBP' },
    'JPY': { locale: 'ja-JP', currency: 'JPY' },
    'CAD': { locale: 'en-CA', currency: 'CAD' },
    'AUD': { locale: 'en-AU', currency: 'AUD' },
    'CHF': { locale: 'de-CH', currency: 'CHF' }
  };

  const config = currencyMap[currency] || currencyMap['BRL'];
  
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency
  }).format(amount);
};

// Hook para conversão de moeda com cache otimizado
export const useCurrencyConversion = () => {
  const [isLoading, setIsLoading] = useState(false); // This hook's loading state seems local and fine.

  const convertToBRL = async (amount, fromCurrency) => {
    if (fromCurrency === 'BRL') return amount;
    
    setIsLoading(true);
    try {
      const convertedAmount = await convertCurrency(amount, fromCurrency, 'BRL');
      setIsLoading(false);
      return convertedAmount;
    } catch (error) {
      setIsLoading(false);
      console.error('Erro na conversão:', error.message);
      return amount; // Fallback
    }
  };

  const preloadExchangeRates = async (currencies = ['USD', 'EUR']) => {
    setIsLoading(true);
    try {
      const promises = currencies.map(currency => 
        getCurrencyExchangeRate(currency, 'BRL')
      );
      await Promise.all(promises);
      console.log('Cotações pré-carregadas (tentativa).');
    } catch (error) {
      console.error('Erro ao pré-carregar cotações:', error.message);
    }
    setIsLoading(false);
  };

  return { convertToBRL, preloadExchangeRates, isLoading };
};

// Função utilitária para limpar cotações antigas (pode ser executada periodicamente)
// This function would ideally be a cron job or Supabase scheduled function.
export const cleanOldExchangeRates = async (daysToKeep = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    // Fetch IDs of rates older than cutoffDateStr
    const { data: allRates, error: fetchError } = await api.get('exchange_rates');
    const ratesToDelete = allRates?.filter(r => r.rate_date < cutoffDateStr);

    if (fetchError) throw fetchError;

    if (ratesToDelete && ratesToDelete.length > 0) {
      const idsToDelete = ratesToDelete.map(rate => rate.id);
      const deletePromises = idsToDelete.map(id => api.delete('exchange_rates', id));
      await Promise.all(deletePromises);
      const deleteError = null;

      if (deleteError) throw deleteError;
      console.log(`${idsToDelete.length} cotações antigas removidas.`);
    } else {
      console.log("Nenhuma cotação antiga para remover.");
    }
    
  } catch (error) {
    console.error('Erro ao limpar cotações antigas:', error.message);
  }
};