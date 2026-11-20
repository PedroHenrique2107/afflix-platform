import { BadRequestException } from '@nestjs/common';
import { PUBLICATION_STATUS_LABELS, PUBLICATION_TRANSITIONS } from '@afflix/shared';
import type { PublicationStatus } from '@afflix/shared';

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return PUBLICATION_TRANSITIONS[from].includes(to);
}

// Transição fora da tabela de PUBLICATION_TRANSITIONS é erro do pedido (400), não conflito de estado.
export function assertTransition(from: PublicationStatus, to: PublicationStatus): void {
  if (canTransition(from, to)) return;
  const allowed = PUBLICATION_TRANSITIONS[from];
  const hint = allowed.length ? `permitidas a partir daqui: ${allowed.join(', ')}` : 'nenhuma transição sai deste status';
  throw new BadRequestException(
    `Transição inválida: ${from} → ${to} (${PUBLICATION_STATUS_LABELS[from]} → ${PUBLICATION_STATUS_LABELS[to]}); ${hint}`,
  );
}
