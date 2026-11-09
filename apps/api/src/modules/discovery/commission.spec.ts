import { describe, it, expect } from 'vitest';
import { meetsMinimumCommission } from './commission';
describe('mínimo de comissão', () => {
  it('aceita exatamente 8%', () => expect(meetsMinimumCommission('0.080000',8)).toBe(true));
  it('rejeita abaixo de 8%', () => expect(meetsMinimumCommission('0.079999',8)).toBe(false));
  it('aceita acima de 8%', () => expect(meetsMinimumCommission('0.11',8)).toBe(true));
  it('rejeita taxa > 100%', () => expect(meetsMinimumCommission('1.10',8)).toBe(false));
  it('rejeita valores inválidos', () => expect(meetsMinimumCommission('abc',8)).toBe(false));
});
