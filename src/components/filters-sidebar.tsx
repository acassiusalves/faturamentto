"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FiltersSidebarProps = {
  shippingOptions: string[];
  brandOptions: string[];
  selectedShipping: string[];
  setSelectedShipping: (v: string[]) => void;
  selectedBrands: string[];
  setSelectedBrands: (v: string[]) => void;
  storeFilter: ("yes" | "no")[];
  setStoreFilter: (v: ("yes" | "no")[]) => void;
  className?: string;
};

export function FiltersSidebar({
  shippingOptions,
  brandOptions,
  selectedShipping,
  setSelectedShipping,
  selectedBrands,
  setSelectedBrands,
  storeFilter,
  setStoreFilter,
  className,
}: FiltersSidebarProps) {
  const [brandQuery, setBrandQuery] = React.useState("");
  const filteredBrands = React.useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brandOptions;
    return brandOptions.filter((b) => (b || "").toLowerCase().includes(q));
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
          <div className="space-y-2 max-h-40 overflow-auto pr-1">
            {shippingOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem opções</p>
            ) : (
              shippingOptions.map((opt) => (
                <label key={opt || "N/A"} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedShipping.includes(opt)}
                    onCheckedChange={() => toggle(selectedShipping, setSelectedShipping, opt)}
                  />
                  <span className="truncate">{opt || "N/A"}</span>
                </label>
              ))
            )}
          </div>
          {selectedShipping.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedShipping.map((s) => (
                <Badge key={s} variant="secondary" className="px-2">
                  {s}
                </Badge>
              ))}
            </div>
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
          <div className="space-y-2 max-h-48 overflow-auto pr-1">
            {filteredBrands.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem resultados</p>
            ) : (
              filteredBrands.map((b) => (
                <label key={b || "N/A"} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedBrands.includes(b)}
                    onCheckedChange={() => toggle(selectedBrands, setSelectedBrands, b)}
                  />
                  <span className="truncate">{b || "N/A"}</span>
                </label>
              ))
            )}
          </div>
          {selectedBrands.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedBrands.map((b) => (
                <Badge key={b} variant="secondary" className="px-2">
                  {b}
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* Tipo de loja */}
        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo de loja</p>
          <div className="space-y-2">
            {[
              { label: "Lojas Oficiais", value: "yes" as const },
              { label: "Lojas Não Oficiais", value: "no" as const },
            ].map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={storeFilter.includes(o.value)}
                  onCheckedChange={() => {
                    if (storeFilter.includes(o.value))
                      setStoreFilter(storeFilter.filter((v) => v !== o.value));
                    else setStoreFilter([...storeFilter, o.value]);
                  }}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {storeFilter.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {storeFilter.map((s) => (
                <Badge key={s} variant="secondary" className="px-2 capitalize">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}