import { describe, expect, it } from 'vitest';
import { canAdminister, canWrite, describeRole } from './roles.js';
import type { MemberRole } from './domain.js';

const ROLES: MemberRole[] = ['owner', 'admin', 'editor', 'viewer'];

describe('workspace roles', () => {
  it('lets owners, admins and editors write; viewers never', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('admin')).toBe(true);
    expect(canWrite('editor')).toBe(true);
    // The whole point of the gate: a viewer must not approve or publish.
    expect(canWrite('viewer')).toBe(false);
  });

  it('reserves administration for owners and admins', () => {
    expect(canAdminister('owner')).toBe(true);
    expect(canAdminister('admin')).toBe(true);
    expect(canAdminister('editor')).toBe(false);
    expect(canAdminister('viewer')).toBe(false);
  });

  it('never grants administration without write', () => {
    for (const role of ROLES) {
      if (canAdminister(role)) expect(canWrite(role)).toBe(true);
    }
  });

  it('describes every role', () => {
    for (const role of ROLES) expect(describeRole(role).length).toBeGreaterThan(0);
  });
});
