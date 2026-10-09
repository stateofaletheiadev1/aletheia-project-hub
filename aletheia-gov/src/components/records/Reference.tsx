export function Reference({ value, className = "" }: { value: string; className?: string }) {
  return <span className={`t-ref ${className}`}>{value}</span>;
}
