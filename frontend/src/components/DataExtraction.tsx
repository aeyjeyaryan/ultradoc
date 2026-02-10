import { useState } from "react";
import { Table, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE as string;

interface DataExtractionProps {
  disabled: boolean;
}

const DataExtraction = ({ disabled }: DataExtractionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Record<string, string | number | null> | null>(null);
  const { toast } = useToast();

  const handleExtract = async () => {
    setIsLoading(true);
    setData(null);

    try {
      const res = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Extraction failed");

      const result = await res.json();
      setData(result);
    } catch {
      toast({
        title: "Extraction failed",
        description: "Could not extract structured data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatKey = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const formatValue = (value: string | number | null) => {
    if (value === null || value === undefined || value === "") return "Not available";
    return String(value);
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleExtract}
        disabled={disabled || isLoading}
        className="bg-primary text-primary-foreground hover:bg-charcoal-light"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Table className="h-4 w-4 mr-2" />
        )}
        Extract Shipment Data
      </Button>

      {isLoading && (
        <div className="rounded-lg border border-border bg-card p-6 animate-pulse-subtle">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="rounded-lg border border-border bg-card overflow-hidden animate-fade-in">
          <div className="divide-y divide-border">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex">
                <div className="w-1/2 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/30">
                  {formatKey(key)}
                </div>
                <div className={`w-1/2 px-4 py-3 text-sm ${
                  value === null || value === undefined || value === ""
                    ? "text-warm-gray italic"
                    : "text-foreground"
                }`}>
                  {formatValue(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataExtraction;
