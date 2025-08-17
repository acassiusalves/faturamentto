import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-cost-category.ts';
import '@/ai/flows/process-list-flow.ts';
import '@/ai/flows/organize-list.ts';
import '@/ai/flows/standardize-list.ts';
import '@/ai/flows/lookup-products.ts';
