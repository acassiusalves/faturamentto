"use client"

import * as React from "react"
import { format, addDays, startOfDay, endOfDay, subDays } from "date-fns"
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "./separator"

interface DateRangePickerProps extends React.ComponentProps<"div"> {
    date: DateRange | undefined;
    onDateChange: (date: DateRange | undefined) => void;
}

export function DateRangePicker({
  className,
  date,
  onDateChange
}: DateRangePickerProps) {

  const handlePresetClick = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth') => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date = endOfDay(today);

    switch (preset) {
        case 'today':
            fromDate = startOfDay(today);
            break;
        case 'yesterday':
            fromDate = startOfDay(subDays(today, 1));
            toDate = endOfDay(subDays(today, 1));
            break;
        case 'last7':
            fromDate = startOfDay(subDays(today, 6));
            break;
        case 'last30':
            fromDate = startOfDay(subDays(today, 29));
            break;
        case 'thisMonth':
            fromDate = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
            break;
    }
    onDateChange({ from: fromDate, to: toDate });
  };


  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                  {format(date.to, "dd/MM/yyyy", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd/MM/yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto p-0" align="start">
          <div className="flex flex-col space-y-2 border-r p-4">
              <span className="text-sm font-medium">Usados recentemente</span>
              <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick('today')}>Hoje</Button>
              <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick('yesterday')}>Ontem</Button>
              <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick('last7')}>Últimos 7 dias</Button>
              <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick('last30')}>Últimos 30 dias</Button>
              <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick('thisMonth')}>Este Mês</Button>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
