
"use client";
import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export type Option = { label: string; value: string };

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  emptyText = "Nenhuma opção",
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const toggle = (val: string) => {
    if (value.includes(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? options.find((o) => o.value === value[0])?.label || placeholder
      : `${value.length} selecionados`;

  return (
    <div className={cn("w-full md:w-[260px]", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"               // <— impede submit acidental
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">{summary}</span>
            <div className="flex items-center gap-2">
              {value.length > 0 && (
                <X className="h-4 w-4 opacity-70 hover:opacity-100" onClick={clearAll} />
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()} // evita focar e fechar sem querer
        >
          <Command>
            <CommandInput placeholder="Filtrar..." />
            <CommandList className="max-h-64 overflow-auto">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const checked = value.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      className="gap-2 cursor-pointer"
                      onSelect={(ev) => {
                        // garante toggle via teclado e alguns browsers
                        ev?.preventDefault?.();
                        toggle(opt.value);
                      }}
                      onClick={(e) => {
                        // garante toggle via mouse em todos os casos
                        e.preventDefault();
                        toggle(opt.value);
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(opt.value)}
                        onClick={(e) => e.stopPropagation()} // não deixa o CommandItem engolir o clique
                      />
                      <span className="flex-1 truncate">{opt.label}</span>
                      {checked && <Check className="h-4 w-4" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((v) => {
            const label = options.find((o) => o.value === v)?.label ?? v;
            return (
              <Badge key={v} variant="secondary" className="px-2 py-1">
                <span className="mr-1">{label}</span>
                <button
                  className="opacity-70 hover:opacity-100"
                  onClick={() => onChange(value.filter((x) => x !== v))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
