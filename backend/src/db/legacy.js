import fs from 'node:fs';

export function legacyLoad({ dataFile, empty }) {
  if (!dataFile || !fs.existsSync(dataFile)) return structuredClone(empty);
  try {
    return { ...structuredClone(empty), ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) };
  } catch (error) {
    throw new Error(`Cannot read legacy data: ${error.message}`);
  }
}
