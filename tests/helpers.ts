import assert from 'node:assert/strict';
import { parse } from 'yaml';

export function parseMapping(text: string): Record<string, unknown> {
  const value: unknown = parse(text);
  assert(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

export function parseRequest(text: string): { query: string; variables: Record<string, unknown> } {
  const value: unknown = JSON.parse(text);
  assert(value && typeof value === 'object' && !Array.isArray(value));
  const result = value as Record<string, unknown>;
  assert.equal(typeof result.query, 'string');
  const variables = result.variables ?? {};
  assert(variables && typeof variables === 'object' && !Array.isArray(variables));
  return { query: result.query as string, variables: variables as Record<string, unknown> };
}
