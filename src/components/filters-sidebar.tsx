
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type DynamicFilterOption = {
  id: string;
  name: string;
  options: string[];
};

type FiltersSidebarProps = {
  filterOptions: DynamicFilterOption[];
  activeFilters: Record<string, string>;
  onFilterChange: (filterId: string, value: string) => void;
  className?: string;
};

export function FiltersSidebar({
  filterOptions,
  activeFilters,
  onFilterChange,
  className,
}: FiltersSidebarProps) {

  const clearAll = () => {
    const clearedFilters: Record<string, string> = {};
    for (const key in activeFilters) {
      clearedFilters[key] = 'all';
    }
    // Apply all changes at once
    Object.entries(clearedFilters).forEach(([key, value]) => onFilterChange(key, value));
  };

  return (
    <aside className={`w-full md:w-64 shrink-0 ${className}`}>
      <div className="rounded-lg border bg-card p-4 sticky top-20">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Filtros da Ficha Técnica</h3>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearAll}>
            Limpar
          </Button>
        </div>
        
        <div className="space-y-4">
            {filterOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum filtro disponível para esta busca.</p>
            ) : (
                filterOptions.map(filter => (
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
                ))
            )}
        </div>
      </div>
    </aside>
  );
}
