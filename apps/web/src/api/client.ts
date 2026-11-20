// Chamadas à api pelo proxy do Vite (/api -> 127.0.0.1:3000). Erro vira Error com a mensagem que a api devolveu.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null) as { message?: string|string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(json?.message) ? json.message.join('; ') : json?.message;
    throw new Error(message || `Falha HTTP ${response.status}`);
  }
  return json as T;
}

export const getJson = <T>(url: string) => request<T>(url);

export const postJson = <T>(url: string, body: unknown) =>
  request<T>(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });

// Multipart: sem Content-Type manual, o navegador monta o boundary.
export const postForm = <T>(url: string, body: FormData) => request<T>(url, { method:'POST', body });

export const errorMessage = (err: unknown) => err instanceof Error ? err.message : 'Falha desconhecida';
