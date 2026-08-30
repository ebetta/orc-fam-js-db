import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, Calendar as CalendarIcon, BarChart, Check, X } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportFilters({ allTags, filters, onFiltersChange, onGenerateReport, isLoading }) {
    const handleTagChange = (tagId, checked) => {
        const tagMap = {};
        allTags.forEach(tag => {
            tagMap[tag.id] = { ...tag, children: [] };
        });
        allTags.forEach(tag => {
            if (tag.parent_tag_id && tagMap[tag.parent_tag_id]) {
                tagMap[tag.parent_tag_id].children.push(tagMap[tag.id]);
            }
        });
        const changedTag = tagMap[tagId];
        onFiltersChange(prev => {
            const newSelectedTags = { ...prev.selectedTags, [tagId]: checked };
            if (changedTag && changedTag.children.length > 0) {
                changedTag.children.forEach(child => {
                    newSelectedTags[child.id] = checked;
                });
            }
            return { ...prev, selectedTags: newSelectedTags };
        });
    };
    
    const handleSelectAllTags = (select) => {
        const newSelectedTags = {};
        allTags.forEach(tag => {
            newSelectedTags[tag.id] = select;
        });
        onFiltersChange(prev => ({ ...prev, selectedTags: newSelectedTags }));
    };

    const organizeTagsHierarchically = (tags) => {
        if (!tags || tags.length === 0) return [];
        const tagMap = {};
        tags.forEach(tag => {
            tagMap[tag.id] = { ...tag, children: [] };
        });
        const rootTags = [];
        tags.forEach(tag => {
            if (tag.parent_tag_id && tagMap[tag.parent_tag_id]) {
                tagMap[tag.parent_tag_id].children.push(tagMap[tag.id]);
            } else {
                rootTags.push(tagMap[tag.id]);
            }
        });
        rootTags.sort((a, b) => a.name.localeCompare(b.name));
        rootTags.forEach(parentTag => {
            parentTag.children.sort((a, b) => a.name.localeCompare(b.name));
        });
        const hierarchicalList = [];
        rootTags.forEach(parentTag => {
            hierarchicalList.push({ ...parentTag, level: 0 });
            parentTag.children.forEach(childTag => {
                hierarchicalList.push({ ...childTag, level: 1 });
            });
        });
        return hierarchicalList;
    };

    const hierarchicalTags = organizeTagsHierarchically(allTags);
    const selectedCount = Object.values(filters.selectedTags).filter(Boolean).length;
    const totalTags = allTags.length;

    return (
        <Card className="shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] bg-white rounded-xl">
            <CardHeader className="border-b border-[#E2E8F0] bg-[#eff4ff] py-4 px-5">
                <CardTitle className="flex items-center gap-2 text-[#0b1c30] text-base">
                    <Filter className="w-4 h-4 text-[#0b1c30]"/>
                    Filtros do Relatório
                </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
                {isLoading ? (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Left column - Period, Type, Action */}
                        <div className="lg:col-span-3 space-y-3">
                            <div>
                                <Label className="font-semibold text-[#0b1c30] text-xs uppercase tracking-wider mb-1.5 block">Período</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-10 w-full justify-start text-left font-normal text-[#0b1c30] border-[#E2E8F0] hover:bg-[#eff4ff] text-sm"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-[#6c7a71]" />
                                            {filters.period?.from ? (
                                                filters.period.to ? (
                                                    <>{format(filters.period.from, "dd/MM/yy")} - {format(filters.period.to, "dd/MM/yy")}</>
                                                ) : (format(filters.period.from, "dd/MM/yy"))
                                            ) : ( <span className="text-[#6c7a71]">Escolha o período</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={filters.period?.from}
                                            selected={filters.period}
                                            onSelect={(range) => onFiltersChange(prev => ({...prev, period: range}))}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div>
                                <Label className="font-semibold text-[#0b1c30] text-xs uppercase tracking-wider mb-1.5 block">Tipo</Label>
                                <RadioGroup
                                    value={filters.reportType}
                                    onValueChange={(value) => onFiltersChange(prev => ({...prev, reportType: value}))}
                                    className="flex gap-4 flex-wrap"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="expenses_by_tag" id="expenses_report" />
                                        <Label htmlFor="expenses_report" className="text-[#0b1c30] text-sm cursor-pointer">Despesas</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="budget" id="budget_report" />
                                        <Label htmlFor="budget_report" className="text-[#0b1c30] text-sm cursor-pointer">Orçamento</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="budget_overrun" id="budget_overrun_report" />
                                        <Label htmlFor="budget_overrun_report" className="text-[#0b1c30] text-sm cursor-pointer">Extrapolado</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            
                            <Button onClick={onGenerateReport} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-10">
                                <BarChart className="w-4 h-4 mr-2"/>
                                Gerar Relatório
                            </Button>
                        </div>

                        {/* Right column - Tags */}
                        <div className="lg:col-span-9 space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Label className="font-semibold text-[#0b1c30] text-xs uppercase tracking-wider">Tags</Label>
                                    <span className="text-[10px] bg-[#dce9ff] text-[#006c49] px-2 py-0.5 rounded-full font-semibold">
                                        {selectedCount}/{totalTags}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => handleSelectAllTags(true)} 
                                        className="text-[#006c49] h-7 text-xs px-2"
                                    >
                                        <Check className="w-3 h-3 mr-1" /> Todas
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => handleSelectAllTags(false)} 
                                        className="text-[#6c7a71] h-7 text-xs px-2"
                                    >
                                        <X className="w-3 h-3 mr-1" /> Limpar
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="h-[18rem] w-full rounded-lg border border-[#E2E8F0] p-3 bg-[#f8f9ff]">
                                <div className="space-y-1.5">
                                    {hierarchicalTags.map(tag => (
                                        <div 
                                            key={tag.id} 
                                            className={`flex items-center space-x-2 ${tag.level === 1 ? 'ml-5' : ''}`}
                                        >
                                            <Checkbox
                                                id={`tag-${tag.id}`}
                                                checked={!!filters.selectedTags[tag.id]}
                                                onCheckedChange={(checked) => handleTagChange(tag.id, checked)}
                                                className="border-[#bbcabf]"
                                            />
                                            <Label 
                                                htmlFor={`tag-${tag.id}`} 
                                                className={`text-sm font-normal flex items-center gap-2 cursor-pointer ${
                                                    tag.level === 0 ? 'font-medium text-[#0b1c30]' : 'text-[#3c4a42]'
                                                }`}
                                            >
                                                <span 
                                                    className="w-2 h-2 rounded-full flex-shrink-0" 
                                                    style={{backgroundColor: tag.color || '#ccc'}}
                                                ></span>
                                                {tag.level === 1 && '└ '}{tag.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
