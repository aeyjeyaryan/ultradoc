import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "http://localhost:8000";

interface UploadResult {
  filename: string;
  chunks_created: number;
  total_characters: number;
}

interface DocumentUploadProps {
  onUploadSuccess: (result: UploadResult) => void;
}

const DocumentUpload = ({ onUploadSuccess }: DocumentUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    const allowed = [".pdf", ".docx", ".txt"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(ext)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, DOCX, or TXT file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data: UploadResult = await res.json();
      setUploadResult(data);
      onUploadSuccess(data);
      toast({
        title: "Document uploaded",
        description: `${data.filename} processed successfully.`,
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload the document. Check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleBrowse = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-10 text-center transition-all duration-200 cursor-pointer
          ${isDragging
            ? "border-copper bg-copper/5"
            : "border-border hover:border-warm-gray hover:bg-muted/30"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
        onClick={handleBrowse}
      >
        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <>
              <div className="h-10 w-10 rounded-full border-2 border-copper border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Processing document…</p>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drop your document here, or <span className="text-copper underline underline-offset-2">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, or TXT — up to 50 MB</p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadResult && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-olive-light border border-olive/20 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-olive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{uploadResult.filename}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {uploadResult.chunks_created} chunks · {uploadResult.total_characters.toLocaleString()} characters
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setUploadResult(null); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
