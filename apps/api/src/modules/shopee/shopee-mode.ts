// Fonte única da chave mock/live. Só sai do mock com SHOPEE_MOCK_MODE=false explícito: vazio, "true" ou typo = mock.
export function isShopeeLiveMode(raw = process.env.SHOPEE_MOCK_MODE): boolean {
  return raw === 'false';
}
