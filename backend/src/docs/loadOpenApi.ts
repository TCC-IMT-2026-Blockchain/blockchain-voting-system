import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export function loadOpenApiDocument() {
  const openApiPath = path.resolve(process.cwd(), 'openapi', 'openapi.yaml');
  const content = fs.readFileSync(openApiPath, 'utf8');
  return parse(content);
}
