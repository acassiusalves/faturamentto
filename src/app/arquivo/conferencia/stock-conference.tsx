"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Save, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { loadInventoryItems, loadAllPickingLogs } from "@/services/firestore";
import type { InventoryItem, PickedItemLog } from "@/lib/types";

const labels = {
    initialStockSystem: "Estoque inicial S.",
    initialStockUser: "Estoque inicial U.",
    receiptsSystem: "Recebimentos S.",
    receiptsUser: "Recebimentos U.",
    returns: "Devoluções Novos",
    withdrawals: "Retiradas", // Agora vem do sistema
    invoiced: "Faturados",
    labelsChange: "Sobra de etiquetas",
    finalStock: "Estoque final",
    realBalance: "Sobra real",
};

interface ConferenceData {
    date: string;
    initialStockSystem: number;
    initialStockUser: number;
    receiptsSystem: number;
    receiptsUser: number;
    returns: number;
    withdrawals: number;
    invoiced: number;
    labelsChange: number;
    finalStock: number;
    realBalance: number;
}

export function StockConference() {
    const [conferenceData, setConferenceData] = useState<ConferenceData[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDataForDate = useCallback(async (date: Date) => {
        setIsLoading(true);

        const [inventoryItems, pickingLogs] = await Promise.all([
            loadInventoryItems(),
            loadAllPickingLogs()
        ]);
        
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const receiptsToday = inventoryItems.filter(item => {
            const createdAt = new Date(item.createdAt);
            return createdAt >= dayStart && createdAt <= dayEnd;
        }).length;

        const withdrawalsToday = pickingLogs.filter(log => {
            const pickedAt = new Date(log.pickedAt);
            return pickedAt >= dayStart && pickedAt <= dayEnd;
        }).length;
        
        const receiptsSinceStartOfDay = inventoryItems.filter(item => new Date(item.createdAt) >= dayStart).length;
        const picksSinceStartOfDay = pickingLogs.filter(log => new Date(log.pickedAt) >= dayStart).length;
        
        const currentStock = inventoryItems.length;
        const initialStock = currentStock - receiptsSinceStartOfDay + picksSinceStartOfDay;

        const newRow: ConferenceData = {
            date: format(date, "yyyy-MM-dd"),
            initialStockSystem: initialStock,
            initialStockUser: 0,
            receiptsSystem: receiptsToday,
            receiptsUser: 0,
            returns: 0,
            withdrawals: withdrawalsToday, // Dado do sistema
            invoiced: 0,
            labelsChange: 0,
            finalStock: 0, 
            realBalance: 0,
        };
        
        newRow.finalStock = newRow.initialStockSystem + newRow.receiptsSystem + newRow.returns - newRow.withdrawals;

        setConferenceData([newRow]);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchDataForDate(selectedDate);
    }, [selectedDate, fetchDataForDate]);
    
    const handleInputChange = (date: string, field: keyof ConferenceData, value: string) => {
        const numericValue = parseInt(value, 10) || 0;
        setConferenceData(prev =>
            prev.map(row => {
                if (row.date === date) {
                    const updatedRow = { ...row, [field]: numericValue };

                    // Recalcula o estoque final quando os campos manuais que o afetam mudam.
                    if (['returns'].includes(field)) {
                         updatedRow.finalStock = updatedRow.initialStockSystem + updatedRow.receiptsSystem + updatedRow.returns - updatedRow.withdrawals;
                    }
                    return updatedRow;
                }
                return row;
            })
        );
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        console.log("Saving data:", conferenceData);
        // Aqui você chamaria um serviço para salvar `conferenceData` no Firestore.
        // A lógica de salvamento ainda precisa ser implementada.
        await new Promise(res => setTimeout(res, 1000)); // Simula salvamento assíncrono
        setIsSaving(false);
    };

    return (
        <Card>
            <CardHeader className="flex flex-col md:flex-row justify-between md:items-center">
                <div>
                    <CardTitle>Conferência Diária de Estoque</CardTitle>
                    <CardDescription>
                        Compare os dados do sistema com a contagem manual para garantir a acuracidade do estoque.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[280px] justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                        Salvar Conferência do Dia
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                 ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {Object.values(labels).map((label) => (
                                        <TableHead key={label} className="whitespace-nowrap">{label}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {conferenceData.map((row) => (
                                    <TableRow key={row.date}>
                                        <TableCell>{row.initialStockSystem}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={row.initialStockUser}
                                                onChange={(e) => handleInputChange(row.date, 'initialStockUser', e.target.value)}
                                                className="w-24"
                                            />
                                        </TableCell>
                                        <TableCell>{row.receiptsSystem}</TableCell>
                                         <TableCell>
                                            <Input
                                                type="number"
                                                value={row.receiptsUser}
                                                onChange={(e) => handleInputChange(row.date, 'receiptsUser', e.target.value)}
                                                className="w-24"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={row.returns}
                                                onChange={(e) => handleInputChange(row.date, 'returns', e.target.value)}
                                                className="w-24"
                                            />
                                        </TableCell>
                                        <TableCell>{row.withdrawals}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={row.invoiced}
                                                onChange={(e) => handleInputChange(row.date, 'invoiced', e.target.value)}
                                                className="w-24"
                                            />
                                        </TableCell>
                                         <TableCell>
                                            <Input
                                                type="number"
                                                value={row.labelsChange}
                                                onChange={(e) => handleInputChange(row.date, 'labelsChange', e.target.value)}
                                                className="w-24"
                                            />
                                        </TableCell>
                                         <TableCell className="font-semibold">{row.finalStock}</TableCell>
                                         <TableCell>
                                            <Input
                                                type="number"
                                                value={row.realBalance}
                                                onChange={(e) => handleInputChange(row.date, 'realBalance', e.target.value)}
                                                className="w-24"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                 )}
            </CardContent>
            <CardFooter>
                 <p className="text-xs text-muted-foreground">
                    Os campos com 'S.' e o campo 'Retiradas' são dados do sistema e não podem ser editados. Os campos com 'U.' são para entrada manual do usuário.
                </p>
            </CardFooter>
        </Card>
    );
}
