
'use server';

/**
 * @fileOverview This file defines a Genkit flow for looking up standardized products in a database.
 *
 * - lookupProducts - Takes a standardized list and finds matching products in the database.
 */

import {getAi} from '@/ai/genkit';
import { LookupProductsInputSchema, type LookupProductsInput, LookupResultSchema, type LookupResult } from '@/lib/types';


const DEFAULT_LOOKUP_PROMPT = `Você é um sistema de correspondência exata para e-commerce de celulares. Sua única tarefa é encontrar o SKU correto para cada produto da lista de entrada, seguindo um algoritmo estruturado e preciso.

**LISTA PADRONIZADA (Entrada para processar):**
'''
{{{productList}}}
'''

**BANCO DE DADOS (Fonte de consulta para SKUs):**
'''
{{{databaseList}}}
'''

## REGRAS FUNDAMENTAIS

### 1. CORRESPONDÊNCIA UM-PARA-UM (CRÍTICO)
- Para CADA linha na entrada, você DEVE gerar EXATAMENTE um objeto JSON na saída
- JAMAIS pule, remova ou duplique produtos
- Se não encontrar correspondência confiável, use "SEM CÓDIGO"
- A quantidade de objetos na saída deve ser IDÊNTICA à quantidade de linhas na entrada

### 2. ALGORITMO DE CORRESPONDÊNCIA ESTRUTURADA
Para cada produto da entrada, siga esta sequência exata:

**Passo 1 - Análise Estruturada:**
- Quebra o produto em: Marca, Modelo, Armazenamento, RAM, Rede, Cor
- Exemplo: "Xiaomi Redmi Note 14 256GB 8GB Preto 5G" → 
  - Marca: Xiaomi
  - Modelo: Redmi Note 14  
  - Armazenamento: 256GB
  - RAM: 8GB
  - Cor: Preto
  - Rede: 5G

**Passo 2 - Filtragem de Candidatos:**
- Selecione APENAS produtos do banco que tenham:
  - MESMA marca
  - MESMO armazenamento (256GB = 256GB)
  - MESMA RAM (8GB = 8GB)

**Passo 3 - Sistema de Pontuação:**
Para cada candidato filtrado, calcule pontos:
- +5 pontos: Modelo compatível (ignore diferenças como "Redmi Note 14" vs "Note 14")
- +2 pontos: RAM e Armazenamento corretos (já filtrados)
- +1 ponto: Rede compatível (4G/5G)
- +0.5 ponto: Cor compatível

**Passo 4 - Decisão:**
- Se pontuação ≥ 7.5: Use o SKU do melhor candidato
- Se pontuação < 7.5: Use "SEM CÓDIGO"

### 3. REGRAS DE REDE (4G/5G)
- Se o produto da entrada NÃO mencionar rede → assuma 4G
- Se houver dois produtos idênticos no banco (um 4G, outro 5G):
  - Entrada sem rede especificada → escolha a versão 4G
  - Entrada com "5G" → escolha a versão 5G

### 4. TOLERÂNCIA PARA VARIAÇÕES
Ignore estas diferenças menores:
- Maiúsculas/minúsculas: "PRETO" = "Preto"
- Formatação: "8/256GB" = "8GB RAM 256GB"
- Palavras extras: "Global", "Versão Global", "/"
- Ordem: "Redmi Note 14" = "Note 14 Redmi"

### 5. EXTRAÇÃO DE PREÇO
- Sempre extraia o último número da linha como preço
- Mantenha como string no formato original
- Exemplos: "1.234,56" → "1.234,56" | "1130" → "1130"

## FORMATO DE SAÍDA OBRIGATÓRIO

'''json
{
  "details": [
    {
      "sku": "SKU_ENCONTRADO_OU_SEM_CÓDIGO",
      "name": "Nome_oficial_do_banco_ou_nome_original_se_sem_código",
      "costPrice": "preço_extraído_como_string"
    }
  ]
}
'''

## ORGANIZAÇÃO FINAL
1. **Ordem por marca:** Xiaomi → Realme → Motorola → Samsung
2. **Ignorar outras marcas:** TECNO, etc. não devem aparecer
3. **"SEM CÓDIGO" no final:** Todos os produtos sem SKU vão para o fim

## EXEMPLOS PRÁTICOS

**Entrada:**
'''
Xiaomi Redmi Note 14 256GB 8GB Preto 4G 915
Realme C75 256GB 8GB Gold 4G 930
'''

**Banco de Dados:**
'''
Xiaomi Redmi Note 14 256GB 8GB Preto 4G	#11P
Realme C75 256GB 8GB Dourado 4G	#04D
'''

**Saída Esperada:**
'''json
{
  "details": [
    {
      "sku": "#11P",
      "name": "Xiaomi Redmi Note 14 256GB 8GB Preto 4G",
      "costPrice": "915"
    },
    {
      "sku": "#04D", 
      "name": "Realme C75 256GB 8GB Dourado 4G",
      "costPrice": "930"
    }
  ]
}
'''

## VALIDAÇÃO FINAL
Antes de retornar, verifique:
- ✅ Quantidade de objetos = quantidade de linhas da entrada
- ✅ Todos os preços foram extraídos corretamente
- ✅ SKUs encontrados existem no banco de dados
- ✅ Nomes oficiais foram usados quando SKU encontrado
- ✅ Organização por marca respeitada

**EXECUTE O PROCESSAMENTO AGORA SEGUINDO EXATAMENTE ESTE ALGORITMO.**
`;
export async function lookupProducts(input: LookupProductsInput): Promise<LookupResult> {
    const ai = getAi(input.apiKey);

    const prompt = ai.definePrompt({
        name: 'lookupProductsPrompt',
        model: 'googleai/gemini-2.0-flash',
        input: {schema: LookupProductsInputSchema},
        output: {schema: LookupResultSchema},
        prompt: input.prompt_override || DEFAULT_LOOKUP_PROMPT,
    });
    
    const {output} = await prompt({ productList: input.productList, databaseList: input.databaseList });
    return output!;
}
