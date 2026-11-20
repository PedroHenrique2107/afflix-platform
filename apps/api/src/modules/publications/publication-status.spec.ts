import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PUBLICATION_STATUSES } from '@afflix/shared';
import type { PublicationStatus } from '@afflix/shared';
import { assertTransition, canTransition } from './publication-status';

const ALLOWED: [PublicationStatus, PublicationStatus][] = [
  ['DRAFT', 'READY'],
  ['DRAFT', 'ARCHIVED'],
  ['READY', 'DRAFT'],
  ['READY', 'PUBLISHED_MANUALLY'],
  ['PUBLISHED_MANUALLY', 'ARCHIVED'],
];
const allowed = new Set(ALLOWED.map(([a, b]) => `${a}>${b}`));
const FORBIDDEN = PUBLICATION_STATUSES.flatMap(from => PUBLICATION_STATUSES.map(to => [from, to] as [PublicationStatus, PublicationStatus]))
  .filter(([from, to]) => !allowed.has(`${from}>${to}`));

describe('transições de Publication', () => {
  it.each(ALLOWED)('%s → %s é permitida', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(FORBIDDEN)('%s → %s é recusada com 400', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(BadRequestException);
  });

  it('cobre a tabela inteira: 5 permitidas e 11 proibidas (inclui pular etapa e voltar de publicada)', () => {
    expect(FORBIDDEN).toHaveLength(11);
    expect(FORBIDDEN).toContainEqual(['DRAFT', 'PUBLISHED_MANUALLY']);
    expect(FORBIDDEN).toContainEqual(['PUBLISHED_MANUALLY', 'READY']);
    expect(FORBIDDEN).toContainEqual(['ARCHIVED', 'DRAFT']);
  });

  it('a mensagem diz quais destinos são permitidos', () => {
    expect(() => assertTransition('DRAFT', 'PUBLISHED_MANUALLY')).toThrow(/permitidas a partir daqui: READY, ARCHIVED/);
  });
});
