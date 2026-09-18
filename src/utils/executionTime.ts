export function combineExecutionDateTime(date: string, time?: string): string | undefined {
  const cleanDate = String(date || '').trim();
  const cleanTime = String(time || '').trim();
  if (!cleanDate || !cleanTime) return undefined;

  const local = new Date(`${cleanDate}T${cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime}`);
  if (Number.isNaN(local.getTime())) return undefined;
  return local.toISOString();
}

export function executionTimeInputValue(executedAt?: string): string {
  if (!executedAt) return '';
  const date = new Date(executedAt);
  if (Number.isNaN(date.getTime())) {
    const match = executedAt.match(/T(\d{2}:\d{2})/);
    return match?.[1] ?? '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function executionDateInputValue(executedAt?: string, fallbackDate = ''): string {
  if (!executedAt) return fallbackDate;
  const date = new Date(executedAt);
  if (Number.isNaN(date.getTime())) return executedAt.slice(0, 10) || fallbackDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatExecutionTime(executedAt?: string): string | null {
  if (!executedAt) return null;
  const date = new Date(executedAt);
  if (Number.isNaN(date.getTime())) {
    const match = executedAt.match(/T(\d{2}):(\d{2})/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = match[2];
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours %= 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${suffix}`;
  }
  return date.toLocaleTimeString('en-EG', { hour: 'numeric', minute: '2-digit', hour12: true });
}
