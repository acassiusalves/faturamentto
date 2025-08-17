"use server";

import type { PipelineResult, OrganizeResult, StandardizeResult, LookupResult } from '@/lib/types';

// This is a mock implementation.
// In a real scenario, these would call Genkit flows.

export async function processListPipelineAction(
  prevState: {
    result: PipelineResult | null;
    error: string | null;
  },
  formData: FormData
): Promise<{
  result: PipelineResult | null;
  error: string | null;
}> {
  await new Promise(resolve => setTimeout(resolve, 5000));
  const productList = formData.get('productList') as string;
  if (!productList) {
      return { result: null, error: "A lista de produtos está vazia." };
  }
  return {
    result: {
      organizedList: "1x Produto A\n2x Produto B",
      standardizedList: "Produto A | 1\nProduto B | 2",
      details: [
        { name: 'Produto A', sku: 'SKU-A', quantity: '1', unitPrice: 'R$ 10,00', totalPrice: 'R$ 10,00' },
        { name: 'Produto B', sku: 'SKU-B', quantity: '2', unitPrice: 'R$ 20,00', totalPrice: 'R$ 40,00' },
      ],
      finalFormattedList: "Produto A\tSKU-A\t1\tR$ 10,00\tR$ 10,00\nProduto B\tSKU-B\t2\tR$ 20,00\tR$ 40,00",
      unprocessedItems: [
        { line: 'Produto C com defeito', reason: 'Formato inválido' }
      ]
    },
    error: null,
  };
}

export async function organizeListAction(
  prevState: any,
  formData: FormData
): Promise<{ result: OrganizeResult | null; error: string | null; }> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const productList = formData.get('productList') as string;
    if (!productList) {
        return { result: null, error: "A lista de produtos está vazia." };
    }
    return {
        result: {
            organizedList: productList.split('\n').map(line => `1x ${line.trim()}`).join('\n')
        },
        error: null
    };
}


export async function standardizeListAction(
    prevState: any,
    formData: FormData
): Promise<{ result: StandardizeResult | null; error: string | null; }> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const organizedList = formData.get('organizedList') as string;
     if (!organizedList) {
        return { result: null, error: "A lista organizada está vazia." };
    }
    return {
        result: {
            standardizedList: organizedList.split('\n').map(line => `${line.replace('1x ', '')} | 1`).join('\n'),
            unprocessedItems: []
        },
        error: null
    };
}


export async function lookupProductsAction(
    prevState: any,
    formData: FormData
): Promise<{ result: LookupResult | null; error: string | null; }> {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const standardizedList = formData.get('productList') as string;
    if (!standardizedList) {
        return { result: null, error: "A lista padronizada está vazia." };
    }
    const details = standardizedList.split('\n').map(line => {
        const [name, qty] = line.split(' | ');
        return {
            name,
            sku: `SKU-${name.charAt(0)}`,
            quantity: qty,
            unitPrice: 'R$ 15,00',
            totalPrice: 'R$ 15,00'
        }
    });

    return {
        result: {
            details,
            finalFormattedList: details.map(d => `${d.name}\t${d.sku}\t${d.quantity}\t${d.unitPrice}\t${d.totalPrice}`).join('\n')
        },
        error: null
    };
}
