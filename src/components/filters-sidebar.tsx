
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type DynamicFilterOption = {
  id: string;
  name: string;
  options: string[];
};

type CountOption = {
    name: string;
    count: number;
}

type StoreTypeOptions = {
    official: number;
    nonOfficial: number;
};

type FiltersSidebarProps = {
  dynamicFilterOptions: DynamicFilterOption[];
  brandOptions: CountOption[];
  shippingOptions: CountOption[];
  storeTypeOptions: StoreTypeOptions;
  activeFilters: Record<string, string>;
  selectedBrands: string[];
  selectedShipping: string[];
  selectedStoreTypes: string[];
  brandSearch: string;
  onFilterChange: (filterId: string, value: string) => void;
  onBrandChange: (brands: string[]) => void;
  onShippingChange: (shipping: string[]) => void;
  onStoreTypeChange: (storeTypes: string[]) => void;
  onBrandSearchChange: (search: string) => void;
  className?: string;
};

export function FiltersSidebar({
  dynamicFilterOptions,
  brandOptions,
  shippingOptions,
  storeTypeOptions,
  activeFilters,
  selectedBrands,
  selectedShipping,
  selectedStoreTypes,
  brandSearch,
  onFilterChange,
  onBrandChange,
  onShippingChange,
  onStoreTypeChange,
  onBrandSearchChange,
  className,
}: FiltersSidebarProps) {

  const handleBrandToggle = (brandName: string) => {
    const newSelection = selectedBrands.includes(brandName)
      ? selectedBrands.filter(b => b !== brandName)
      : [...selectedBrands, brandName];
    onBrandChange(newSelection);
  };
  
  const handleShippingToggle = (shippingName: string) => {
    const newSelection = selectedShipping.includes(shippingName)
      ? selectedShipping.filter(s => s !== shippingName)
      : [...selectedShipping, shippingName];
    onShippingChange(newSelection);
  }

  const handleStoreTypeToggle = (storeType: 'official' | 'non-official') => {
      const newSelection = selectedStoreTypes.includes(storeType)
        ? selectedStoreTypes.filter(st => st !== storeType)
        : [...selectedStoreTypes, storeType];
      onStoreTypeChange(newSelection);
  }

  const clearAll = () => {
    const clearedFilters: Record<string, string> = {};
    for (const key in activeFilters) {
      clearedFilters[key] = 'all';
    }
    Object.entries(clearedFilters).forEach(([key, value]) => onFilterChange(key, value));
    onBrandChange([]);
    onShippingChange([]);
    onStoreTypeChange([]);
    onBrandSearchChange("");
  };

  const filteredBrands = React.useMemo(() => {
    if (!brandSearch) return brandOptions;
    return brandOptions.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brandOptions, brandSearch]);

  return (
    <aside className={`w-full md:w-64 shrink-0 ${className}`}>
      <div className="rounded-lg border bg-card p-4 sticky top-20">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Filtros</h3>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearAll}>
            Limpar
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-12rem)] pr-4 -mr-4">
        <div className="space-y-6">
            
            {/* Tipo de Loja */}
            {(storeTypeOptions.official > 0 || storeTypeOptions.nonOfficial > 0) && (
                 <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Tipo de loja</h4>
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="store-type-official" className="flex items-center gap-2 font-normal cursor-pointer">
                                <Checkbox id="store-type-official" checked={selectedStoreTypes.includes('official')} onCheckedChange={() => handleStoreTypeToggle('official')} />
                                Lojas Oficiais
                            </Label>
                            <span className="text-xs text-muted-foreground">{storeTypeOptions.official}</span>
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="store-type-non-official" className="flex items-center gap-2 font-normal cursor-pointer">
                                <Checkbox id="store-type-non-official" checked={selectedStoreTypes.includes('non-official')} onCheckedChange={() => handleStoreTypeToggle('non-official')} />
                                Lojas Não Oficiais
                            </Label>
                             <span className="text-xs text-muted-foreground">{storeTypeOptions.nonOfficial}</span>
                        </div>
                    </div>
                </div>
            )}


            {/* Tipos de Entrega */}
            {shippingOptions.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Tipos de entrega</h4>
                    <div className="space-y-2">
                        {shippingOptions.map(opt => (
                            <div key={opt.name} className="flex items-center justify-between">
                                <Label htmlFor={`ship-${opt.name}`} className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Checkbox id={`ship-${opt.name}`} checked={selectedShipping.includes(opt.name)} onCheckedChange={() => handleShippingToggle(opt.name)} />
                                    {opt.name}
                                </Label>
                                <span className="text-xs text-muted-foreground">{opt.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Marcas */}
            {brandOptions.length > 0 && (
                 <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Marcas</h4>
                    <Input placeholder="Filtrar marcas..." value={brandSearch} onChange={e => onBrandSearchChange(e.target.value)} />
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                         {filteredBrands.map(opt => (
                            <div key={opt.name} className="flex items-center justify-between">
                                <Label htmlFor={`brand-${opt.name}`} className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Checkbox id={`brand-${opt.name}`} checked={selectedBrands.includes(opt.name)} onCheckedChange={() => handleBrandToggle(opt.name)} />
                                    {opt.name}
                                </Label>
                                <span className="text-xs text-muted-foreground">{opt.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Filtros Dinâmicos */}
            {dynamicFilterOptions.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Ficha Técnica</h4>
                    {dynamicFilterOptions.map(filter => (
                        <div key={filter.id} className="space-y-1.5">
                            <Label htmlFor={`filter-${filter.id}`} className="text-sm font-medium">{filter.name}</Label>
                            <Select
                                value={activeFilters[filter.id] || 'all'}
                                onValueChange={(value) => onFilterChange(filter.id, value)}
                            >
                                <SelectTrigger id={`filter-${filter.id}`}>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {filter.options.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            )}
        </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
