import type { MemberRole } from './domain.js';

/**
 * What each workspace role may do. Roles were stored on invite but enforced nowhere, so a
 * viewer could approve a plan and publish to live social accounts. This is the single
 * definition every gate reads from.
 *
 *  - viewer: read only.
 *  - editor: create, edit, schedule, approve and publish content.
 *  - admin/owner: the above, plus social connections (they hold credentials) and the team.
 */
const WRITERS: readonly MemberRole[] = ['owner', 'admin', 'editor'];
const ADMINISTRATORS: readonly MemberRole[] = ['owner', 'admin'];

export function canWrite(role: MemberRole): boolean {
  return WRITERS.includes(role);
}

export function canAdminister(role: MemberRole): boolean {
  return ADMINISTRATORS.includes(role);
}

/** Human-readable summary of a role, for the team screen. */
export function describeRole(role: MemberRole): string {
  switch (role) {
    case 'owner':
      return 'Full access, including billing and the team.';
    case 'admin':
      return 'Full access, including connections and the team.';
    case 'editor':
      return 'Can create, approve, schedule and publish content.';
    case 'viewer':
      return 'Can view everything; cannot make changes.';
  }
}
