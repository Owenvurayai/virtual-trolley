/** 134260 -> "R1,342.60" (matches the backend's receipts). */
export function money(cents: number): string {
  const rands = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R${rands}`;
}

/** 12500 -> "12.5 kg". */
export function kg(grams: number): string {
  return `${(grams / 1000).toFixed(1)} kg`;
}

/** 2400 -> "2.4 s"; 75000 -> "1:15". */
export function duration(ms: number): string {
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
