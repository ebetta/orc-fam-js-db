import { Card, CardContent } from "@/components/ui/card";

const fmtCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
};

export default function WelcomeCard({ netWorth, isLoading }) {
  return (
    <Card className="bg-gradient-to-r from-[#006c49] to-[#10b981] border border-outline-variant shadow-sm overflow-hidden relative rounded-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />

      <CardContent className="p-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="font-label-md text-xs tracking-widest uppercase text-white/80 mb-2">
              Saldo Total Consolidado
            </p>
            {isLoading ? (
              <div className="h-14 w-64 bg-white/20 rounded-xl animate-pulse" />
            ) : (
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                {fmtCurrency(netWorth)}
              </h2>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
