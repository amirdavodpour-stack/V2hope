import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export async function persistLegacyFile({ dataFile, state, storageDir }) {
  if (!dataFile) return;
  const dir = path.dirname(dataFile);
  await fs.promises.mkdir(dir || storageDir || '.', { recursive: true });
  const temp = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.promises.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
  await fs.promises.rename(temp, dataFile);
}
