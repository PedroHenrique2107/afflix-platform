import { afterEach, describe, expect, it, vi } from 'vitest';
import { shopeeStatus } from './integrations.controller';
import { isShopeeLiveMode } from '../shopee/shopee-mode';

const FAKE_APP_ID = 'app-id-fake-123';
const FAKE_SECRET = 'secret-fake-456';
const client = (last: Date | null) => ({ getLastSuccessAt: () => last });

describe('isShopeeLiveMode', () => {
  it('só "false" exato liga o live', () => {
    expect(isShopeeLiveMode('false')).toBe(true);
    for (const raw of [undefined, '', 'true', 'FALSE', 'False', ' false', '0', 'no']) expect(isShopeeLiveMode(raw)).toBe(false);
  });
});

describe('GET /integrations/status', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('mock por padrão e sem sincronização ainda', () => {
    vi.stubEnv('SHOPEE_MOCK_MODE', 'true');
    expect(shopeeStatus(client(null))).toEqual({ data: { shopee: { mode: 'mock', lastSuccessfulSyncAt: null } } });
  });

  it('live com a data da última chamada OK em ISO 8601', () => {
    vi.stubEnv('SHOPEE_MOCK_MODE', 'false');
    const last = new Date('2026-11-20T12:34:56.000Z');
    expect(shopeeStatus(client(last))).toEqual({ data: { shopee: { mode: 'live', lastSuccessfulSyncAt: '2026-11-20T12:34:56.000Z' } } });
  });

  it('nenhum campo ou valor de credencial na resposta', () => {
    vi.stubEnv('SHOPEE_MOCK_MODE', 'false');
    vi.stubEnv('SHOPEE_APP_ID', FAKE_APP_ID);
    vi.stubEnv('SHOPEE_APP_SECRET', FAKE_SECRET);
    const body = JSON.stringify(shopeeStatus(client(new Date())));
    expect(body).not.toContain(FAKE_APP_ID);
    expect(body).not.toContain(FAKE_SECRET);
    expect(body).not.toContain(FAKE_APP_ID.slice(0, 6));
    expect(body).not.toMatch(/appId|app_id|secret|credential|token|key/i);
    expect(Object.keys(JSON.parse(body).data.shopee).sort()).toEqual(['lastSuccessfulSyncAt', 'mode']);
  });
});
