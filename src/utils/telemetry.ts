import fs from 'fs';
import path from 'path';

type HobRecord = {
  ts: number;
  symbol: string;
  interval: string;
  latestClose?: number;
  hob: any;
};

function ensureDir(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

function telemetryFile(): string {
  const outDir = path.resolve(process.cwd(), 'data');
  ensureDir(outDir);
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return path.join(outDir, `telemetry-${yyyy}-${mm}-${dd}.jsonl`);
}

export function logHOBs(symbol: string, interval: string, latestClose: number | undefined, hobs: any[]): void {
  if (!Array.isArray(hobs) || hobs.length === 0) return;
  const file = telemetryFile();
  const now = Date.now();
  const lines = hobs.map(h => JSON.stringify({ ts: now, symbol, interval, latestClose, hob: h } as HobRecord)).join('\n') + '\n';
  try {
    fs.appendFileSync(file, lines, { encoding: 'utf-8' });
  } catch {}
}

export function logNote(note: Record<string, any>): void {
  const file = telemetryFile();
  const payload = { ts: Date.now(), type: 'note', ...note };
  try {
    fs.appendFileSync(file, JSON.stringify(payload) + '\n', { encoding: 'utf-8' });
  } catch {}
}

export function logSnapshot(symbol: string, interval: string, latestClose: number | undefined, features: Record<string, any>): void {
  const file = telemetryFile();
  const payload = { ts: Date.now(), type: 'snapshot_features', symbol, interval, latestClose, features };
  try {
    fs.appendFileSync(file, JSON.stringify(payload) + '\n', { encoding: 'utf-8' });
  } catch {}
}

export function logShadowRecommendation(symbol: string, interval: string, recommendation: Record<string, any>): void {
  const file = telemetryFile();
  const payload = { ts: Date.now(), type: 'shadow_recommendation', symbol, interval, recommendation };
  try {
    fs.appendFileSync(file, JSON.stringify(payload) + '\n', { encoding: 'utf-8' });
  } catch {}
}

export function logActualTrade(symbol: string, details: Record<string, any>): void {
  const file = telemetryFile();
  const payload = { ts: Date.now(), type: 'actual_trade', symbol, details };
  try {
    fs.appendFileSync(file, JSON.stringify(payload) + '\n', { encoding: 'utf-8' });
  } catch {}
}

export function pruneOldTelemetry(days = 30): void {
  const outDir = path.resolve(process.cwd(), 'data');
  ensureDir(outDir);
  const files = fs.readdirSync(outDir).filter(f => f.startsWith('telemetry-') && f.endsWith('.jsonl'));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const f of files) {
    const fp = path.join(outDir, f);
    try {
      const st = fs.statSync(fp);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(fp);
      }
    } catch {}
  }
}