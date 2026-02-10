import { FileText, Wifi, WifiOff } from "lucide-react";

interface StatusPanelProps {
  apiOnline: boolean;
  documentLoaded: boolean;
  documentName: string | null;
  isChecking: boolean;
}

const StatusPanel = ({ apiOnline, documentLoaded, documentName, isChecking }: StatusPanelProps) => {
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        {isChecking ? (
          <div className="h-2 w-2 rounded-full bg-warm-gray animate-pulse-subtle" />
        ) : apiOnline ? (
          <div className="h-2 w-2 rounded-full bg-olive" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-destructive" />
        )}
        <span className="text-muted-foreground">
          {isChecking ? "Checking…" : apiOnline ? "API Online" : "API Offline"}
        </span>
      </div>

      {documentLoaded && documentName && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span className="max-w-[160px] truncate">{documentName}</span>
        </div>
      )}
    </div>
  );
};

export default StatusPanel;
