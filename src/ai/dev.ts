
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-cost-category.ts';
import '@/ai/flows/process-list-flow.ts';
import '@/ai/flows/organize-list.ts';
import '@/ai/flows/standardize-list.ts';
import '@/ai/flows/lookup-products.ts';
import '@/ai/flows/analyze-feed-flow.ts';
import '@/ai/flows/analyze-label-flow.ts';
import '@/ai/flows/analyze-zpl-flow.ts';
import '@/ai/flows/remix-label-data-flow.ts';
import '@/ai/flows/regenerate-zpl-flow.ts';
import '@/ai/flows/analyze-catalog-flow.ts';
import '@/ai/flows/search-mercado-livre-flow.ts';
import '@/ai/flows/refine-search-term-flow.ts';
import '@/ai/flows/find-trending-products-flow.ts';
import '@/ai/flows/generate-embedding-flow.ts';
