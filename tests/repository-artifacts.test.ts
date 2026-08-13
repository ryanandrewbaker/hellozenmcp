import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

function readRepoFile(name: string): string {
  return readFileSync(join(root, name), 'utf8');
}

describe('repository artifact security', () => {
  const requiredSecretPatterns = [
    '.env',
    '.env.*',
    '!.env.example',
    'DEPLOYMENT.local.md',
    '*.pem',
    '*.key',
    '*.p12',
  ];

  const requiredDockerOnlyPatterns = [
    '.git',
    '.github',
    'node_modules',
    'dist',
    'coverage',
    '*.log',
  ];

  it('defines .dockerignore with secret and build exclusions', () => {
    const dockerignore = readRepoFile('.dockerignore');

    for (const pattern of requiredSecretPatterns) {
      expect(dockerignore).toContain(pattern);
    }
    for (const pattern of requiredDockerOnlyPatterns) {
      expect(dockerignore).toContain(pattern);
    }
  });

  it('defines .cursorignore with secret exclusions and allows .env.example', () => {
    const cursorignore = readRepoFile('.cursorignore');

    for (const pattern of requiredSecretPatterns) {
      expect(cursorignore).toContain(pattern);
    }

    for (const pattern of requiredDockerOnlyPatterns) {
      expect(cursorignore).not.toContain(pattern);
    }
  });

  it('keeps .env.example versioned and present', () => {
    const envExample = readRepoFile('.env.example');
    expect(envExample).toContain('HELLOZEN_MCP_READONLY_TOKEN=');
    expect(envExample).not.toMatch(/pit-[a-z0-9-]+/i);
  });

  it('does not copy secrets or use broad COPY in Dockerfile', () => {
    const dockerfile = readRepoFile('Dockerfile');

    expect(dockerfile).not.toMatch(/COPY\s+\.\s/m);
    expect(dockerfile).not.toMatch(/COPY\s+\.\s+\//m);
    expect(dockerfile).not.toMatch(/ADD\s+\.\s/m);
    expect(dockerfile).not.toMatch(/\.env\b/);

    const copyLines = dockerfile
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('COPY '));

    expect(copyLines).toEqual([
      'COPY package.json package-lock.json ./',
      'COPY tsconfig.json ./',
      'COPY src ./src',
      'COPY package.json package-lock.json ./',
      'COPY --from=build /app/dist ./dist',
    ]);
  });
});
