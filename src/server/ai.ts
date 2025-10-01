
// src/server/ai.ts
import "server-only";
import { loadAppSettings } from "@/services/firestore";
import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { OpenAI } from 'openai';


/** Defina aqui os modelos/IA por etapa */
export type StepId = "organizar" | "padronizar" | "lookup" | "mapear" | "precificar" | "teste_gpt";


export const STEP_EXECUTION: Record<StepId, { provider: "openai" | "gemini"; model: string }> = {
  organizar:  { provider: "gemini", model: "gemini-2.0-flash" },
  padronizar: { provider: "gemini", model: "gemini-2.0-flash" },
  lookup:     { provider: "gemini", model: "gemini-2.0-flash" },
  mapear:     { provider: "gemini", model: "gemini-2.0-flash" },
  precificar: { provider: "gemini", model: "gemini-2.0-flash" },
  teste_gpt:  { provider: "openai", model: "gpt-4o-mini" },
};

/** Chamada OpenAI via SDK, server-only */
async function callOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
    const openai = new OpenAI({ apiKey });

    try {
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: model,
            response_format: { type: "json_object" },
        });

        const content = chatCompletion.choices[0]?.message?.content;

        if (!content) {
            throw new Error("A API da OpenAI não retornou conteúdo.");
        }
        
        return content;
        
    } catch (error) {
        console.error("Erro na chamada da API OpenAI:", error);
        throw new Error(`OpenAI Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}


/** Chamada Gemini via Genkit, que já está configurado no projeto */
async function callGemini(prompt: string, model: string): Promise<string> {
  const settings = await loadAppSettings();
  const ai = getAi(settings?.geminiApiKey);

  const geminiPrompt = ai.definePrompt({
    name: 'genericGeminiPrompt',
    model: model, // O modelo já vem com o prefixo googleai/ do runStep
    prompt: prompt,
    output: {
      format: 'json'
    }
  });

  try {
    const { output } = await geminiPrompt();
    if (typeof output !== 'string') {
      return JSON.stringify(output);
    }
    return output;
  } catch (e) {
    console.error("Erro na chamada da API Gemini via Genkit:", e);
    throw new Error(`Gemini Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

/** Função genérica para uma etapa */
export async function runStep(step: StepId, prompt: string): Promise<string> {
  const { provider, model } = STEP_EXECUTION[step];
  const settings = await loadAppSettings();

  if (provider === "openai") {
    const key = settings?.openaiApiKey;
    if (!key) throw new Error("OPENAI_API_KEY não encontrada nas App Settings (página de Mapeamento).");
    return await callOpenAI(prompt, model, key);
  } else {
    return await callGemini(prompt, `googleai/${model}`);
  }
}
