interface ConfidenceBarProps {
  score: number; // 0 to 1
}

const ConfidenceBar = ({ score }: ConfidenceBarProps) => {
  const percentage = Math.round(score * 100);
  const getColorClass = () => {
    if (score >= 0.7) return "bg-olive";
    if (score >= 0.4) return "bg-copper";
    return "bg-warm-gray";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums w-10 text-right">
        {percentage}%
      </span>
    </div>
  );
};

export default ConfidenceBar;
