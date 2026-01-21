import fs from 'fs';
import path from 'path';

export type TfOverrides = {
  minQuality?: number;
  veryStrongMinQuality?: number;
  requireLTFConfirmations?: boolean;
  excludeInvalidated?: boolean;
  onlyFullyMitigated?: boolean;
};

export type LearningConfig = {
  iteration: number;
  createdAt: number;
  overrides: {
    default?: Record<string, TfOverrides>; // by interval
    symbols?: Record<string, Record<string, TfOverrides>>; // symbol -> interval -> overrides
  };
};

function learningDir(): string {
  const dir = path.resolve(process.cwd(), 'data', 'learning');
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

export function loadLatestConfig(): LearningConfig | null {
  const dir = learningDir();
  const files = fs.readdirSync(dir).filter(f => f.startsWith('iteration-') && f.endsWith('.json')).sort();
  const latest = files[files.length - 1];
  if (!latest) return null;
  try {
    const raw = fs.readFileSync(path.join(dir, latest), 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

export function getOverrides(symbol: string, interval: string): TfOverrides {
  const cfg = loadLatestConfig();
  if (!cfg) return {};
  const symMap = cfg.overrides?.symbols?.[symbol];
  const defMap = cfg.overrides?.default;
  return (symMap && symMap[interval]) || (defMap && defMap[interval]) || {};
}
