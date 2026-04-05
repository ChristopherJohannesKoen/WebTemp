import type { Role } from '@packages/shared';

export function canSeeAdminNav(role: Role) {
  return role === 'owner' || role === 'admin';
}

export function canAccessAdmin(role: Role) {
  return canSeeAdminNav(role);
}
