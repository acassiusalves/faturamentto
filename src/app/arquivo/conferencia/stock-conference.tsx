"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const labels = {
    initialStockSystem: "Estoque inicial S.",
    initialStockUser: "Estoque inicial U.",
    receiptsSystem: "Recebimentos S.",
    receiptsUser: "Recebimentos U.",
    returns: "Devoluções Novos",
    withdrawals: "Retiradas",
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

    useEffect(() => {
        // Mock data for now, will be replaced with Firestore logic
        const mockData: ConferenceData = {
            date: format(selectedDate, "yyyy-MM-dd"),
            initialStockSystem: 1500, // This would come from a system calculation
            initialStockUser: 0,
            receiptsSystem: 120, // This would come from a system calculation
            receiptsUser: 0,
            returns: 0,
            withdrawals: 0,
            invoiced: 0,
            labelsChange: 0,
            finalStock: 1620, // Calculated field
            realBalance: 0,
        };
        
        // Calculate final stock
        mockData.finalStock = mockData.initialStockSystem + mockData.receiptsSystem + mockData.returns - mockData.withdrawals;

        setConferenceData([mockData]);
    }, [selectedDate]);
    
    const handleInputChange = (date: string, field: keyof ConferenceData, value: string) => {
        const numericValue = parseInt(value, 10) || 0;
        setConferenceData(prev =>
            prev.map(row => {
                if (row.date === date) {
                    const updatedRow = { ...row, [field]: numericValue };

                    // Recalculate finalStock whenever a dependent value changes
                    if (['returns', 'withdrawals'].includes(field)) {
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
        // Here you would call a service to save `conferenceData` to Firestore
        await new Promise(res => setTimeout(res, 1000)); // Simulate async save
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
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="mr-2" />
                        Salvar Conferência do Dia
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
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
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={row.withdrawals}
                                            onChange={(e) => handleInputChange(row.date, 'withdrawals', e.target.value)}
                                            className="w-24"
                                        />
                                    </TableCell>
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
            </CardContent>
            <CardFooter>
                 <p className="text-xs text-muted-foreground">
                    Os campos com 'S.' são dados do sistema e não podem ser editados. Os campos com 'U.' são para entrada manual do usuário.
                </p>
            </CardFooter>
        </Card>
    );
}
