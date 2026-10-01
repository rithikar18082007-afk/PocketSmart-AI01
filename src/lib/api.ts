let currentToken: string | null = null;

export function setApiToken(token: string | null) {
  currentToken = token;
}

export function getApiToken(): string | null {
  return currentToken;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody && errBody.error) {
        errorMessage = errBody.error;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

export async function downloadTransactionsCSV(): Promise<void> {
  const headers: Record<string, string> = {};
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }
  const res = await fetch('/api/transactions/export', { headers });
  if (!res.ok) {
    throw new Error('Failed to export transactions CSV');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pocketsmart-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
