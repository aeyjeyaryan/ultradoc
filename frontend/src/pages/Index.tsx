import { useState, useEffect, useCallback } from "react";
import { FileText, Search, Table as TableIcon, Zap } from "lucide-react";
import StatusPanel from "@/components/StatusPanel";
import DocumentUpload from "@/components/DocumentUpload";
import AskQuestion from "@/components/AskQuestion";
import DataExtraction from "@/components/DataExtraction";

const API_BASE = import.meta.env.VITE_API_BASE as string;

interface UploadResult {
  filename: string;
  chunks_created: number;
  total_characters: number;
}

const Index = () => {
  const [apiOnline, setApiOnline] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [documentName, setDocumentName] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) {
        const data = await res.json();
        setApiOnline(true);
        setDocumentLoaded(data.document_loaded ?? false);
        setDocumentName(data.document_name ?? null);
      } else {
        setApiOnline(false);
      }
    } catch {
      setApiOnline(false);
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleUploadSuccess = (result: UploadResult) => {
    setDocumentLoaded(true);
    setDocumentName(result.filename);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container max-w-4xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Ultra Doc-Intelligence
            </span>
          </div>
          <StatusPanel
            apiOnline={apiOnline}
            documentLoaded={documentLoaded}
            documentName={documentName}
            isChecking={isCheckingStatus}
          />
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <section className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Ask. Extract. Understand.
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-lg mx-auto">
            Your documents, instantly. Upload any document and let AI surface insights, answer questions, and extract structured data.
          </p>
        </section>

        {/* Sections */}
        <div className="space-y-12">
          {/* Upload */}
          <section>
            <SectionHeader
              icon={FileText}
              title="Upload Document"
              description="PDF, DOCX, or TXT files"
            />
            <DocumentUpload onUploadSuccess={handleUploadSuccess} />
          </section>

          {/* Ask */}
          <section>
            <SectionHeader
              icon={Search}
              title="Ask a Question"
              description="Query your document using natural language"
            />
            <AskQuestion disabled={!documentLoaded} />
          </section>

          {/* Extract */}
          <section>
            <SectionHeader
              icon={TableIcon}
              title="Structured Extraction"
              description="Pull structured shipment data from your document"
            />
            <DataExtraction disabled={!documentLoaded} />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Ultra Doc-Intelligence · Enterprise Document Analysis Platform
          </p>
        </div>
      </footer>
    </div>
  );
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default Index;
