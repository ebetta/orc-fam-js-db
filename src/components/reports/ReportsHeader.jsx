import { Card, CardContent } from "@/components/ui/card";
import { BarChart } from "lucide-react";

export default function ReportsHeader() {
  return (
    <Card className="bg-gradient-to-br from-cyan-600 to-cyan-800 border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <BarChart className="w-7 h-7 text-white" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Relatórios</h1>
        </div>
      </CardContent>
    </Card>
  );
}
