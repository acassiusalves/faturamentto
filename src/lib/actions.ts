// @ts-nocheck
"use server";

import { suggestCostCategory, type SuggestCostCategoryInput } from "@/ai/flows/suggest-cost-category";

export async function getCategorySuggestion(input: SuggestCostCategoryInput) {
  // This is a workaround for a bug in the AI SDK that causes a type error
  // when the function is called from a client component.
  const result = await suggestCostCategory(input);
  return result;
}
