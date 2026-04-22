import { promises as fs } from 'fs';
import path from 'path';
import type { Event } from './types';

const useKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

const localFile = () => path.join(process.cwd(), '.data', 'sync.json');

type Snapshot = { updatedAt: number; events: Event[] };

async function readLocal(): Promise<Record<string, Snapshot>> {
  try {
    const raw = await fs.readFile(localFile(), 'utf8');
    return JSON.parse(raw) as Record<string, Snapshot>;
  } catch {
    return {};
  }
}

async function writeLocal(data: Record<string, Snapshot>): Promise<void> {
  const dir = path.dirname(localFile());
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
  await fs.writeFile(localFile(), JSON.stringify(data));
}

export async function getSnapshot(token: string): Promise<Snapshot | null> {
  if (useKV) {
    const { kv } = await import('@vercel/kv');
    return ((await kv.get<Snapshot>(`snap:${token}`)) ?? null) as Snapshot | null;
  }
  const data = await readLocal();
  return data[token] ?? null;
}

export async function putSnapshot(token: string, events: Event[]): Promise<void> {
  const snap: Snapshot = { updatedAt: Date.now(), events };
  if (useKV) {
    const { kv } = await import('@vercel/kv');
    await kv.set(`snap:${token}`, snap);
    return;
  }
  const data = await readLocal();
  data[token] = snap;
  await writeLocal(data);
}
