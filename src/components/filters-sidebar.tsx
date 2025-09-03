
"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FilterOption = {
    value: string;
    label: string;
    count: number;
}

type FiltersSidebarProps = {
  shippingOptions: FilterOption[];
  brandOptions: FilterOption[];
  storeTypeCounts: { official: number; nonOfficial: number };
  selectedShipping: string[];
  setSelectedShipping: (v: string[]) => void;
  selectedBrands: string[];
  setSelectedBrands: (v: string[]) => void;
  storeFilter: ("yes"|"no")[];
  setStoreFilter: (v: ("yes" | "no")[]) => void;
  className?: string;
};

const INITIAL_VISIBLE_COUNT = 7;

export function FiltersSidebar({
  shippingOptions,
  brandOptions,
  storeTypeCounts,
  selectedShipping,
  setSelectedShipping,
  selectedBrands,
  setSelectedBrands,
  storeFilter,
  setStoreFilter,
  className,
}: FiltersSidebarProps) {
  const [brandQuery, setBrandQuery] = React.useState("");
  const [showAllBrands, setShowAllBrands] = React.useState(false);
  const [showAllShipping, setShowAllShipping] = React.useState(false);

  const filteredBrands = React.useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brandOptions;
    return brandOptions.filter((b) => (b.label || "").toLowerCase().includes(q));
  }, [brandOptions, brandQuery]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    if (list.includes(value)) setList(list.filter((v) => v !== value));
    else setList([...list, value]);
  };

  const clearAll = () => {
    setSelectedShipping([]);
    setSelectedBrands([]);
    setStoreFilter([]);
  };
  
  const visibleBrands = showAllBrands ? filteredBrands : filteredBrands.slice(0, INITIAL_VISIBLE_COUNT);
  const visibleShipping = showAllShipping ? shippingOptions : shippingOptions.slice(0, INITIAL_VISIBLE_COUNT);


  return (
    <aside className={cn("w-full md:w-64 shrink-0", className)}>
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearAll}>
            Limpar
          </Button>
        </div>
        
        {/* Tipos de entrega */}
        <section className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tipos de entrega</p>
          <div className="space-y-2 pr-1">
            {visibleShipping.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem opções</p>
            ) : (
              visibleShipping.map((opt) => (
                <label key={opt.value || "N/A"} className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox
                        checked={selectedShipping.includes(opt.value)}
                        onCheckedChange={() => toggle(selectedShipping, setSelectedShipping, opt.value)}
                    />
                    <span className="truncate">{opt.label || "N/A"}</span>
                  </div>
                  <Badge variant="outline" className="font-normal">{opt.count}</Badge>
                </label>
              ))
            )}
          </div>
           {!showAllShipping && shippingOptions.length > INITIAL_VISIBLE_COUNT && (
            <Button
              variant="link"
              className="px-0 h-auto text-primary"
              onClick={() => setShowAllShipping(true)}
            >
              Mostrar mais
            </Button>
          )}
        </section>

        {/* Marcas */}
        <section className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Marcas</p>
          <Input
            placeholder="Filtrar marcas..."
            className="mb-2 h-8 text-sm"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
          />
          <div className="space-y-2 pr-1">
            {visibleBrands.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem resultados</p>
            ) : (
              visibleBrands.map((b) => (
                <label key={b.value || "N/A"} className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={selectedBrands.includes(b.value)}
                            onCheckedChange={() => toggle(selectedBrands, setSelectedBrands, b.value)}
                        />
                        <span className="truncate">{b.label || "N/A"}</span>
                   </div>
                   <Badge variant="outline" className="font-normal">{b.count}</Badge>
                </label>
              ))
            )}
          </div>
          {!showAllBrands && filteredBrands.length > INITIAL_VISIBLE_COUNT && (
            <Button
              variant="link"
              className="px-0 h-auto text-primary"
              onClick={() => setShowAllBrands(true)}
            >
              Mostrar mais
            </Button>
          )}
        </section>

        {/* Tipo de loja */}
        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo de loja</p>
          <div className="space-y-2">
            {[
              { label: "Lojas Oficiais", value: "yes" as const, count: storeTypeCounts.official },
              { label: "Lojas Não Oficiais", value: "no" as const, count: storeTypeCounts.nonOfficial },
            ].map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                    <Checkbox
                      checked={storeFilter.includes(o.value)}
                      onCheckedChange={() => {
                        if (storeFilter.includes(o.value))
                          setStoreFilter(storeFilter.filter((v) => v !== o.value));
                        else setStoreFilter([...storeFilter, o.value]);
                      }}
                    />
                    <span>{o.label}</span>
                </div>
                 <Badge variant="outline" className="font-normal">{o.count}</Badge>
              </label>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
