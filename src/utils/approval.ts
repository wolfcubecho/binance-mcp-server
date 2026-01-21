import fs from 'fs';
import path from 'path';

export type ApprovalGate = {
  useIterationForTrading: boolean;
  minSamples?: number;
  minDays?: number;
  approvedAt?: number;
  reason?: string;
};

function approvalPath(): string {
  return path.resolve(process.cwd(), 'data', 'learning', 'approved.json');
}

export function loadApprovalGate(): ApprovalGate {
  try {
    const raw = fs.readFileSync(approvalPath(), 'utf-8');
    const obj = JSON.parse(raw);
    return {
      useIterationForTrading: !!obj.useIterationForTrading,
      minSamples: obj.minSamples,
      minDays: obj.minDays,
      approvedAt: obj.approvedAt,
      reason: obj.reason,
    };
  } catch {
    return { useIterationForTrading: false };
  }
}

export function writeApprovalGate(gate: ApprovalGate): void {
  try {
    const dir = path.dirname(approvalPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(approvalPath(), JSON.stringify(gate, null, 2), 'utf-8');
  } catch {}
}