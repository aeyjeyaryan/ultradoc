import { useState } from "react";
import { Send, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ConfidenceBar from "./ConfidenceBar";

const API_BASE = "http://localhost:8000";

interface Source {
  text: string;
  page?: number;
  chunk_id?: string;
}

interface AskResponse {
  answer: string;
  confidence: number;
  sources: Source[];
}

interface AskQuestionProps {
  disabled: boolean;
}

const AskQuestion = ({ disabled }: AskQuestionProps) => {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || disabled) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok) throw new Error("Request failed");

      const data: AskResponse = await res.json();
      setResponse(data);
    } catch {
      toast({
        title: "Request failed",
        description: "Could not get an answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={disabled ? "Upload a document first…" : "Ask a question about your document…"}
          disabled={disabled || isLoading}
          className="flex-1 h-11 px-4 rounded-lg border border-input bg-surface-elevated text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          disabled={disabled || isLoading || !question.trim()}
          className="h-11 px-5 bg-primary text-primary-foreground hover:bg-charcoal-light"
        >
          {isLoading ? (
            <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {isLoading && (
        <div className="p-6 rounded-lg border border-border bg-card animate-pulse-subtle">
          <div className="space-y-3">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
      )}

      {response && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4 animate-fade-in">
          <div>
            <p className="text-sm leading-relaxed text-foreground">{response.answer}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confidence</span>
              {response.confidence < 0.5 && (
                <span className="inline-flex items-center gap-1 text-xs text-copper">
                  <AlertTriangle className="h-3 w-3" />
                  Low confidence
                </span>
              )}
            </div>
            <ConfidenceBar score={response.confidence} />
          </div>

          {response.sources && response.sources.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sources</span>
              {response.sources.map((source, i) => (
                <div key={i} className="rounded-md border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedSource(expandedSource === i ? null : i)}
                    className="flex items-center justify-between w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>
                      Source {i + 1}
                      {source.page != null && ` · Page ${source.page}`}
                    </span>
                    {expandedSource === i ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {expandedSource === i && (
                    <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-border bg-muted/20">
                      <p className="pt-2">{source.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AskQuestion;
