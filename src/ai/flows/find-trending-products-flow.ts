
'use server';

import { loadAllTrendKeywords } from '@/services/firestore';
import { z } from 'genkit';

const TrendingProductInfoSchema = z.object({
  productName: z.string(),
  matchedKeywords: z.array(z.string()),
});
export type TrendingProductsOutput = { trendingProducts: z.infer<typeof TrendingProductInfoSchema>[] };


type CatId =
  | "audio.speakers"
  | "printers"
  | "gaming.consoles"
  | "computers.laptops"
  | "cameras"
  | "office.registers";

type CatProfile = {
  id: CatId;
  typeSynonyms: string[];   // FRASES/TOKENS que caracterizam o TIPO daquele produto
  includeTokens: string[];  // tokens que costumam aparecer em termos válidos dessa categoria
};

const CATS: CatProfile[] = [
  {
    id: "audio.speakers",
    typeSynonyms: ["caixa de som","caixa som","alto falante","alto-falante","speaker","boombox","soundbar","caixa acustica","barra de som"],
    includeTokens: ["bluetooth","bt","fm","radio","sd","aux","usb","led","rgb","bass","super bass","portatil","multimidia"]
  },
  { id: "printers",
    typeSynonyms: ["impressora","multifuncional","cartucho","toner"],
    includeTokens: ["epson","canon","hp","lexmark","brother","resina","sublimacao"]
  },
  { id: "gaming.consoles",
    typeSynonyms: ["console","videogame","controle","joystick"],
    includeTokens: ["xbox","playstation","ps4","ps5","nintendo","switch"]
  },
  { id: "computers.laptops",
    typeSynonyms: ["notebook","laptop","macbook","ultrabook"],
    includeTokens: ["ssd","memoria","carregador","magsafe","intel","amd","apple"]
  },
  { id: "cameras",
    typeSynonyms: ["camera","lente","dslr","mirrorless","gopro"],
    includeTokens: ["canon","nikon","sony","estanque","iso","sensor"]
  },
  { id: "office.registers",
    typeSynonyms: ["caixa registradora","pdv","fiscal","cupom"],
    includeTokens: ["elgin","daruma","tanca","ecf"]
  },
];

const norm = (s:string) =>
  s.toLowerCase()
   .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .replace(/[^\p{L}\p{N}\s]/gu," ")
   .replace(/\s+/g," ").trim();

const hasAny = (txt:string, terms:string[]) =>
  terms.some(t => norm(txt).includes(norm(t)));

const jaccard = (a:string[], b:string[]) => {
  const A=new Set(a), B=new Set(b);
  const inter=[...A].filter(x=>B.has(x)).length;
  const uni=new Set([...a,...b]).size||1;
  return inter/uni;
};

const toks = (s:string) => norm(s).split(" ").filter(Boolean);

// 1) descobre a categoria do PRODUTO
function classifyProductCategory(text:string): CatProfile | null {
  const n = norm(text);
  // score por presença de typeSynonyms
  const scored = CATS.map(c=>{
    const hits = c.typeSynonyms.filter(t=>n.includes(norm(t))).length;
    return { c, score: hits };
  }).sort((a,b)=>b.score-a.score);

  return scored[0].score > 0 ? scored[0].c : null;
}

// 2) filtra sugestões com contexto
function filterTrendsContextual(productText:string, suggestions:string[], minScore=2) {
  const cat = classifyProductCategory(productText);
  if (!cat) {
    // sem categoria detectada => aplica apenas similaridade básica
    const base = toks(productText);
    return [...new Set(suggestions)]
      .map(term=>{
        const sim = jaccard(base, toks(term));
        const ok = sim >= 0.35;
        return { term, score: ok ? sim*2 : -1, reasons: ok?["sim"]:[ "baixa similaridade" ] };
      })
      .filter(x=>x.score>=minScore)
      .sort((a,b)=>b.score-a.score);
  }

  // negativos = tokens das OUTRAS categorias
  const negatives = CATS.filter(c=>c.id!==cat.id)
                        .flatMap(c=>[...c.typeSynonyms, ...c.includeTokens])
                        .map(norm);

  const baseTokens = toks(productText);
  const typeNorm = cat.typeSynonyms.map(norm);
  const includeNorm = cat.includeTokens.map(norm);

  const unique = Array.from(new Set(suggestions.map(s=>s.trim()).filter(Boolean)));

  const scored = unique.map(term=>{
    const t = norm(term);
    const reasons:string[] = [];
    let score = 0;

    // precisa ter o TIPO da categoria
    if (hasAny(t, typeNorm)) { score += 2; reasons.push("tipo ok"); }
    else { return { term, score: -50, reasons: ["sem tipo da categoria"] }; }

    // sinais da categoria (ajudam)
    includeNorm.forEach(tok => { if (t.includes(tok)) { score += 0.6; reasons.push(`sinal:${tok}`); } });

    // se tiver fortes sinais de outra categoria E não tiver mais nada do nosso tipo, derruba
    const hasNegative = negatives.some(neg => t.includes(neg));
    if (hasNegative && !hasAny(t, typeNorm)) {
      return { term, score: -999, reasons: ["sinal forte de outra categoria"] };
    }

    // similaridade com a descrição
    const sim = jaccard(baseTokens, toks(term));
    if (sim >= 0.40) { score += 1; reasons.push("sim>=0.40"); }
    else if (sim >= 0.25) { score += 0.5; reasons.push("sim>=0.25"); }

    return { term, score, reasons };
  });

  return scored.filter(s=>s.score>=minScore).sort((a,b)=>b.score-a.score);
}


export async function findTrendingProducts(productNames: string[]): Promise<TrendingProductsOutput> {
  const trendKeywords = await loadAllTrendKeywords();
  if (!trendKeywords?.length || !productNames?.length) return { trendingProducts: [] };

  const out: TrendingProductsOutput['trendingProducts'] = [];
  
  for (const name of productNames) {
    const filtered = filterTrendsContextual(name, trendKeywords);
    const hits = filtered.map(f => f.term);
    if (hits.length) {
      out.push({ productName: name, matchedKeywords: hits });
    }
  }

  return { trendingProducts: out };
}
