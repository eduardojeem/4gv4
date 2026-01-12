import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowLeft, Calendar as CalendarIcon, Download } from 'lucide-react'
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface PosDashboardHeaderProps {
    dateRange: DateRange | undefined
    setDateRange: (range: DateRange | undefined) => void
    onExport: () => void
}

export function PosDashboardHeader({ dateRange, setDateRange, onExport }: PosDashboardHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/pos">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver al POS
                    </Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard POS</h2>
                    <p className="text-muted-foreground">
                        Resumen de ventas y métricas principales
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[300px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                        {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                        {format(dateRange.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(dateRange.from, "LLL dd, y", { locale: es })
                                )
                            ) : (
                                <span>Seleccionar fechas</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>

                <Button variant="outline" onClick={onExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar
                </Button>
            </div>
        </div>
    )
}
