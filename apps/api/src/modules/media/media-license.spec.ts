import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { assertMediaPublishable, mediaLicenseStatus } from './media-license';

const now = new Date('2026-11-20T12:00:00Z');
const asset = (overrides: Partial<{ rightsEvidence: string | null; licenseExpiresAt: Date | null }> = {}) =>
  ({ id: 'a1', rightsEvidence: 'Contrato #1', licenseExpiresAt: null, ...overrides });

describe('regra de licença da mídia', () => {
  it('com prova e sem vencimento é publicável', () => {
    expect(mediaLicenseStatus(asset(), now)).toBe('VALID');
    expect(() => assertMediaPublishable(asset(), now)).not.toThrow();
  });

  it('sem prova de licença não pode ser associada a uma publicação', () => {
    expect(mediaLicenseStatus(asset({ rightsEvidence: null }), now)).toBe('MISSING_EVIDENCE');
    expect(mediaLicenseStatus(asset({ rightsEvidence: '  ' }), now)).toBe('MISSING_EVIDENCE');
    expect(() => assertMediaPublishable(asset({ rightsEvidence: null }), now)).toThrow(ConflictException);
  });

  it('licença vencida não pode ser associada a uma publicação', () => {
    const expired = asset({ licenseExpiresAt: new Date('2026-11-19T23:59:59Z') });
    expect(mediaLicenseStatus(expired, now)).toBe('EXPIRED');
    expect(() => assertMediaPublishable(expired, now)).toThrow(ConflictException);
    expect(mediaLicenseStatus(asset({ licenseExpiresAt: new Date('2026-11-21T00:00:00Z') }), now)).toBe('VALID');
  });
});
