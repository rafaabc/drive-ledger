import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Read + parse at runtime rather than `import spec from '...json'` — a static JSON
// import needs an import-assertion syntax that differs between Turbopack (dev) and
// Webpack (prod build, per CLAUDE.md's documented dev/prod split), so this route
// would need two different import forms. Reading the file directly works identically
// under both bundlers and needs no special Next.js config.
const specPath = path.join(process.cwd(), 'resources', 'swagger.json');

export async function GET() {
  const raw = await readFile(specPath, 'utf-8');
  const spec = JSON.parse(raw);
  return NextResponse.json(spec);
}
