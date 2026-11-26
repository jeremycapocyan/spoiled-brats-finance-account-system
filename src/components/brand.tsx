export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-logo ${compact ? "compact" : ""}`}><img src="/brand/logo-original.png" alt="Spoiled Brats Café" /></span>;
}
