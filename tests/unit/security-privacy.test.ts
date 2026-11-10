import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  Role,
  Permission,
  ResourceAccess,
  UserCategory,
  VerificationStatus,
} from '../../packages/permissions/src/index';

describe('Security and privacy documentation', () => {
  it('threat model covers required areas', () => {
    const content = readFileSync(join(process.cwd(), 'docs/security/THREAT_MODEL.md'), 'utf-8');
    const areas = ['authentication', 'authorization', 'tenant isolation', 'api security', 'database', 'file storage', 'secrets', 'encryption', 'audit', 'backups', 'ai security', 'administration'];
    for (const a of areas) expect(content.toLowerCase()).toContain(a);
  });
  it('privacy spec references DPA and NPC guidance', () => {
    const content = readFileSync(join(process.cwd(), 'docs/privacy/PRIVACY_SPECIFICATION.md'), 'utf-8');
    expect(content).toMatch(/Republic Act No\. 10173|Data Privacy Act/i);
    expect(content).toMatch(/National Privacy Commission|NPC/i);
    expect(content).toMatch(/AI.*guidance|Guidelines on Artificial Intelligence/i);
  });
  it('AI governance references SC framework', () => {
    const content = readFileSync(join(process.cwd(), 'docs/privacy/AI_GOVERNANCE.md'), 'utf-8');
    expect(content).toMatch(/A\.M\. No\. 25-11-28-SC|Supreme Court.*AI Governance/i);
  });
  it('permission types exported', () => {
    expect(Role).toBeDefined();
    expect(Permission).toBeDefined();
    expect(ResourceAccess).toBeDefined();
    expect(UserCategory).toBeDefined();
    expect(VerificationStatus).toBeDefined();
    expect(Object.values(Role)).toContain('platform_admin');
    expect(Object.values(ResourceAccess)).toContain('ALLOW');
  });
});