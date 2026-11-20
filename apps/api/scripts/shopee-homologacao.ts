/*
 * Homologação da busca Shopee contra a conta real (SW-4).
 *
 * Uso (na raiz do monorepo):
 *   pnpm --filter @afflix/api shopee:homologar
 *   pnpm --filter @afflix/api shopee:homologar "fone bluetooth"
 *
 * Faz poucas chamadas (introspecção + 1 busca de 3 itens; sondagem campo a campo só se a busca falhar).
 * Nunca imprime App ID, secret, assinatura nem headers. URLs saem sem query string.
 * A saída pode ser colada na conversa/PR — mesmo assim, confira antes.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { describeGraphqlErrors, signShopeePayload } from '../src/modules/shopee/shopee-graphql.client';
import { PRODUCT_OFFERS_QUERY } from '../src/modules/shopee/shopee.queries';

config({ path: resolve(__dirname, '../../../.env') });

const APP_ID = process.env.SHOPEE_APP_ID ?? '';
const SECRET = process.env.SHOPEE_APP_SECRET ?? '';
const API_URL = process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.com.br/graphql';
const KEYWORD = process.argv.slice(2).filter(a => a !== '--').join(' ').trim() || 'organizador de cozinha';

// Campos que a PRODUCT_OFFERS_QUERY pede hoje (mantenha em sincronia com shopee.queries.ts).
const QUERY_FIELDS = ['itemId', 'shopId', 'productName', 'productLink', 'offerLink', 'imageUrl',
  'priceMin', 'priceMax', 'commissionRate', 'commission', 'ratingStar', 'sales'];

// Última barreira: qualquer string impressa passa por aqui.
function safe(text: string): string {
  let out = text;
  for (const secret of [APP_ID, SECRET]) if (secret.length >= 4) out = out.split(secret).join('***');
  return out;
}
const log = (...parts: unknown[]) => console.log(safe(parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')));

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search ? '?…' : ''}`;
  } catch { return '(url inválida)'; }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type GraphqlResult = { status: number; raw: string; json?: { data?: any; errors?: any[] } };

async function call(query: string, variables: Record<string, unknown> = {}): Promise<GraphqlResult> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ query, variables });
  const signature = signShopeePayload(APP_ID, timestamp, body, SECRET);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    const raw = await response.text();
    let json: GraphqlResult['json'];
    try { json = JSON.parse(raw); } catch { json = undefined; }
    return { status: response.status, raw, json };
  } finally {
    clearTimeout(timer);
    await sleep(1000); // gentileza com a quota da conta
  }
}

function reportErrors(label: string, result: GraphqlResult): boolean {
  if (result.status !== 200) log(`  [${label}] HTTP ${result.status}`);
  if (result.json?.errors?.length) {
    log(`  [${label}] errors: ${describeGraphqlErrors(result.json.errors)}`);
    return true;
  }
  if (!result.json) log(`  [${label}] corpo não é JSON (${result.raw.length} bytes)`);
  return result.status !== 200 || !result.json;
}

type TypeRef = { kind: string; name: string | null; ofType?: TypeRef | null };
const TYPE_REF = 'kind name ofType { kind name ofType { kind name ofType { kind name } } }';
function describeType(t?: TypeRef | null): string {
  if (!t) return '?';
  if (t.kind === 'NON_NULL') return `${describeType(t.ofType)}!`;
  if (t.kind === 'LIST') return `[${describeType(t.ofType)}]`;
  return t.name ?? '?';
}
function baseName(t?: TypeRef | null): string | null {
  while (t && !t.name) t = t.ofType;
  return t?.name ?? null;
}

async function typeFields(name: string) {
  const r = await call(`{ __type(name: "${name}") { name fields { name type { ${TYPE_REF} } } } }`);
  if (reportErrors(`introspecção ${name}`, r)) return null;
  return (r.json?.data?.__type?.fields ?? null) as Array<{ name: string; type: TypeRef }> | null;
}

async function introspect() {
  log('\n## 1. Introspecção do schema');
  const q = await call(`{ __type(name: "Query") { fields { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } } } }`);
  if (reportErrors('introspecção Query', q)) { log('  Introspecção indisponível — seguindo só com a busca real.'); return; }
  const field = (q.json?.data?.__type?.fields ?? []).find((f: any) => f.name === 'productOfferV2');
  if (!field) { log('  productOfferV2 NÃO aparece em Query.'); return; }
  log(`  productOfferV2(${field.args.map((a: any) => `${a.name}: ${describeType(a.type)}`).join(', ')}): ${describeType(field.type)}`);

  const connName = baseName(field.type);
  const conn = connName ? await typeFields(connName) : null;
  if (!conn) return;
  log(`  ${connName}: ${conn.map(f => `${f.name}: ${describeType(f.type)}`).join(', ')}`);

  const nodesType = baseName(conn.find(f => f.name === 'nodes')?.type);
  const nodes = nodesType ? await typeFields(nodesType) : null;
  if (!nodes) return;
  log(`  ${nodesType} (${nodes.length} campos):`);
  for (const f of nodes) log(`    ${QUERY_FIELDS.includes(f.name) ? '*' : ' '} ${f.name}: ${describeType(f.type)}`);
  const missing = QUERY_FIELDS.filter(name => !nodes.some(f => f.name === name));
  log(`  (* = pedido pela PRODUCT_OFFERS_QUERY) | pedidos e inexistentes no schema: ${missing.length ? missing.join(', ') : 'nenhum'}`);
}

function describeValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string' && /^https?:\/\//.test(value)) return `string ${redactUrl(value)}`;
  if (typeof value === 'string') return `string "${value.slice(0, 80)}"`;
  return `${typeof value} ${JSON.stringify(value)}`;
}

// Lê os números direto do texto cru: JSON.parse já teria perdido precisão acima de 2^53.
function rawValues(raw: string, field: string): string[] {
  const re = new RegExp(`"${field}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|-?[0-9.eE+-]+|null)`, 'g');
  return [...raw.matchAll(re)].map(m => m[1]);
}

async function search() {
  log(`\n## 2. Busca real: productOfferV2(keyword: "${KEYWORD}", page: 1, limit: 3)`);
  const r = await call(PRODUCT_OFFERS_QUERY, { keyword: KEYWORD, page: 1, limit: 3 });
  if (reportErrors('busca', r)) return false;
  const conn = r.json?.data?.productOfferV2;
  if (!conn) { log('  data.productOfferV2 ausente'); return false; }
  log(`  pageInfo: ${JSON.stringify(conn.pageInfo)}`);
  const nodes: any[] = Array.isArray(conn.nodes) ? conn.nodes : [];
  log(`  nodes: ${nodes.length}`);
  nodes.forEach((node, i) => {
    log(`  --- item ${i + 1}`);
    for (const f of QUERY_FIELDS) log(`    ${f}: ${describeValue(f, node[f])}`);
  });

  log('\n## 3. Valores crus (texto da resposta, antes do JSON.parse)');
  for (const f of ['itemId', 'shopId']) {
    const values = rawValues(r.raw, f);
    const verdict = values.map(v => {
      if (v.startsWith('"')) return `${v} (string — seguro)`;
      const n = Number(v);
      return `${v} (${Number.isSafeInteger(n) ? 'number seguro' : 'number ACIMA DE 2^53 — PERDE PRECISÃO'})`;
    });
    log(`  ${f}: ${verdict.join(' | ') || '(ausente)'}`);
  }
  for (const f of ['commissionRate', 'commission', 'priceMin', 'priceMax', 'ratingStar', 'sales']) {
    log(`  ${f}: ${rawValues(r.raw, f).join(' | ') || '(ausente)'}`);
  }
  const rates = rawValues(r.raw, 'commissionRate').map(v => Number(v.replace(/"/g, ''))).filter(Number.isFinite);
  if (rates.length) {
    const max = Math.max(...rates);
    log(`  escala commissionRate: ${max <= 1 ? 'parece FRAÇÃO (0.08 = 8%) — bate com o domínio' : 'parece PERCENTUAL (8 = 8%) — domínio precisa converter'}`);
  }
  return true;
}

async function probeFields() {
  log('\n## 4. Sondagem campo a campo (a busca completa falhou)');
  for (const f of QUERY_FIELDS) {
    const q = `query P($keyword: String!) { productOfferV2(keyword: $keyword, page: 1, limit: 1) { nodes { ${f} } } }`;
    const r = await call(q, { keyword: KEYWORD });
    const failed = r.status !== 200 || !!r.json?.errors?.length || !r.json;
    log(`  ${failed ? 'REJEITADO' : 'ok       '} ${f}${failed && r.json?.errors ? ` → ${describeGraphqlErrors(r.json.errors)}` : ''}`);
  }
  const args = `query A($keyword: String!) { productOfferV2(keyword: $keyword, listType: 1, sortType: 5, page: 1, limit: 1) { nodes { itemId } } }`;
  const r = await call(args, { keyword: KEYWORD });
  const failed = r.status !== 200 || !!r.json?.errors?.length;
  log(`  ${failed ? 'REJEITADO' : 'ok       '} argumentos listType: 1, sortType: 5${failed && r.json?.errors ? ` → ${describeGraphqlErrors(r.json.errors)}` : ''}`);
}

async function main() {
  log('# Homologação Shopee — productOfferV2');
  log(`  data: ${new Date().toISOString()}`);
  log(`  endpoint: ${redactUrl(API_URL)}`);
  log(`  SHOPEE_APP_ID: ${APP_ID ? 'definido' : 'AUSENTE'} | SHOPEE_APP_SECRET: ${SECRET ? 'definido' : 'AUSENTE'} | SHOPEE_MOCK_MODE: ${process.env.SHOPEE_MOCK_MODE ?? '(vazio)'}`);
  if (!APP_ID || !SECRET) { log('Credenciais ausentes no .env da raiz. Nada foi chamado.'); process.exitCode = 1; return; }

  await introspect();
  const ok = await search();
  if (!ok) await probeFields();
  log('\nFim. Nenhuma credencial foi impressa; confira a saída antes de colar.');
}

main().catch(error => {
  console.error(safe(`Falha: ${error instanceof Error ? `${error.name}: ${error.message}` : 'erro desconhecido'}`));
  process.exitCode = 1;
});
