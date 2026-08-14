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
    expect(envExample).toContain('HELLOZEN_MCP_RESOURCE_URL=');
    expect(envExample).toContain('HELLOZEN_MCP_OAUTH_ISSUER=');
    expect(envExample).not.toContain('HELLOZEN_MCP_AUTH_ENABLED');
    expect(envExample).not.toContain('HELLOZEN_MCP_ALLOW_AUTH_DISABLED');
    expect(envExample).not.toContain('HELLOZEN_MCP_REQUIRED_SCOPE');
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

  it('keeps compose cloudflared image pinned', () => {
    const compose = readRepoFile('compose.cloudflare.yml');
    expect(compose).toContain('cloudflare/cloudflared:2026.7.3');
    expect(compose).not.toContain('cloudflared:latest');
  });

  it('keeps compose on-demand with loopback binding and hardened runtime', () => {
    const compose = readRepoFile('compose.yml');

    expect(compose).toMatch(/restart:\s*["']?no["']?/);
    expect(compose).not.toMatch(/restart:\s*always/);
    expect(compose).not.toMatch(/restart:\s*unless-stopped/);
    expect(compose).toContain('127.0.0.1:8790:8790');
    expect(compose).not.toContain('0.0.0.0:8790');
    expect(compose).toContain('read_only: true');
    expect(compose).toContain('cap_drop:');
    expect(compose).toContain('no-new-privileges:true');
    expect(compose).toContain('env_file:');
  });

  it('documents on-demand operation in README and SECURITY', () => {
    const readme = readRepoFile('README.md');
    const security = readRepoFile('SECURITY.md');

    expect(readme.toLowerCase()).toContain('on-demand');
    expect(readme).toMatch(/STOPPED/i);
    expect(readme).toContain('docker compose start hellozen-mcp');
    expect(readme).toContain('docker compose stop hellozen-mcp');
    expect(readme).toContain('restart: "no"');

    expect(security.toLowerCase()).toContain('on-demand');
    expect(security.toLowerCase()).toContain('defence in depth');
    expect(security).toMatch(/STOPPED/i);
  });

  it('includes OAuth deployment guide and backlog', () => {
    const oauthGuide = readRepoFile('docs/oauth-and-deployment.md');
    const fieldGuide = readRepoFile('docs/connecting-to-chatgpt.md');
    const backlog = readRepoFile('docs/BACKLOG.md');
    const changelog = readRepoFile('CHANGELOG.md');

    expect(oauthGuide).toContain('OAuth');
    expect(oauthGuide).toContain('Cloudflare Tunnel');
    expect(fieldGuide).toContain('Secure MCP Tunnel');
    expect(backlog).toContain('v1.1');
    expect(changelog).toContain('1.1.0');
    expect(changelog).toContain('1.0.0');
  });
});
