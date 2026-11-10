// @phli/permissions — RBAC/ABAC types
// Responsibility: see docs/security/SECURITY_ARCHITECTURE.md §4

/** Platform-level roles. */
export enum Role {
  PLATFORM_ADMIN = 'platform_admin',
  ORG_ADMIN = 'org_admin',
  LAWYER = 'lawyer',
  RESEARCHER = 'researcher',
  STUDENT = 'student',
  PUBLIC_USER = 'public_user',
}

/** Resource-action permissions. Format: `resource:action`. */
export enum Permission {
  // Research
  RESEARCH_QUERY = 'research:query',
  RESEARCH_HISTORY_READ = 'research:history:read',
  RESEARCH_HISTORY_DELETE = 'research:history:delete',
  RESEARCH_EXPORT = 'research:export',
  // Library
  LIBRARY_READ = 'library:read',
  LIBRARY_SEARCH = 'library:search',
  LIBRARY_BOOKMARK = 'library:bookmark',
  LIBRARY_DOWNLOAD = 'library:download',
  // Documents
  DOCUMENTS_UPLOAD = 'documents:upload',
  DOCUMENTS_READ = 'documents:read',
  DOCUMENTS_ANALYZE = 'documents:analyze',
  DOCUMENTS_DELETE = 'documents:delete',
  DOCUMENTS_SHARE = 'documents:share',
  // Drafts
  DRAFTS_CREATE = 'drafts:create',
  DRAFTS_READ = 'drafts:read',
  DRAFTS_UPDATE = 'drafts:update',
  DRAFTS_DELETE = 'drafts:delete',
  DRAFTS_EXPORT = 'drafts:export',
  DRAFTS_COLLABORATE = 'drafts:collaborate',
  // Matters
  MATTERS_CREATE = 'matters:create',
  MATTERS_READ = 'matters:read',
  MATTERS_UPDATE = 'matters:update',
  MATTERS_DELETE = 'matters:delete',
  MATTERS_ASSIGN = 'matters:assign',
  // Org
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_MEMBERS_INVITE = 'org:members:invite',
  ORG_MEMBERS_REMOVE = 'org:members:remove',
  ORG_BILLING_READ = 'org:billing:read',
  // Admin
  ADMIN_USERS_READ = 'admin:users:read',
  ADMIN_USERS_UPDATE = 'admin:users:update',
  ADMIN_SOURCES_MANAGE = 'admin:sources:manage',
  ADMIN_INGESTION_TRIGGER = 'admin:ingestion:trigger',
}

/** Resource access decision. */
export enum ResourceAccess {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
  CONDITIONAL = 'CONDITIONAL',
}

/** User account categories (dossier §5.1). */
export enum UserCategory {
  PUBLIC = 'public',
  PROFESSIONAL = 'professional',
  INSTITUTIONAL = 'institutional',
}

/** Professional verification status — separate from account category. */
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/** Assignment of a role to a user within an organization. */
export interface RoleAssignment {
  userId: string;
  orgId: string;
  role: Role;
  assignedAt: string;
  assignedBy: string;
}

/** Explicit permission grant, possibly beyond role defaults. */
export interface PermissionGrant {
  userId: string;
  permission: Permission;
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

/** Effective permissions for a request context. */
export interface EffectivePermissions {
  userId: string;
  orgId: string;
  roles: Role[];
  permissions: Permission[];
  tier: UserCategory;
  verification: VerificationStatus;
}

/** A resource being accessed. */
export interface ResourceDescriptor {
  type: 'document' | 'draft' | 'matter' | 'research' | 'library' | 'org';
  id: string;
  orgId: string;
  ownerId?: string;
  classification: 'public' | 'internal' | 'private' | 'confidential' | 'highly_restricted';
  sharedWith?: string[];
}

/** Authorization request. */
export interface AuthorizationRequest {
  principal: EffectivePermissions;
  resource: ResourceDescriptor;
  permission: Permission;
}

/** Authorization decision. */
export interface AuthorizationDecision {
  access: ResourceAccess;
  reason: string;
  evaluatedAt: string;
}

/** Default role → permission mapping. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.PLATFORM_ADMIN]: Object.values(Permission),
  [Role.ORG_ADMIN]: [
    Permission.RESEARCH_QUERY,
    Permission.RESEARCH_HISTORY_READ,
    Permission.LIBRARY_READ,
    Permission.LIBRARY_SEARCH,
    Permission.DOCUMENTS_UPLOAD,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_ANALYZE,
    Permission.DRAFTS_CREATE,
    Permission.DRAFTS_READ,
    Permission.DRAFTS_UPDATE,
    Permission.MATTERS_CREATE,
    Permission.MATTERS_READ,
    Permission.MATTERS_UPDATE,
    Permission.MATTERS_ASSIGN,
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_MEMBERS_INVITE,
    Permission.ORG_MEMBERS_REMOVE,
    Permission.ORG_BILLING_READ,
  ],
  [Role.LAWYER]: [
    Permission.RESEARCH_QUERY,
    Permission.RESEARCH_HISTORY_READ,
    Permission.RESEARCH_HISTORY_DELETE,
    Permission.RESEARCH_EXPORT,
    Permission.LIBRARY_READ,
    Permission.LIBRARY_SEARCH,
    Permission.LIBRARY_BOOKMARK,
    Permission.LIBRARY_DOWNLOAD,
    Permission.DOCUMENTS_UPLOAD,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_ANALYZE,
    Permission.DOCUMENTS_DELETE,
    Permission.DOCUMENTS_SHARE,
    Permission.DRAFTS_CREATE,
    Permission.DRAFTS_READ,
    Permission.DRAFTS_UPDATE,
    Permission.DRAFTS_DELETE,
    Permission.DRAFTS_EXPORT,
    Permission.DRAFTS_COLLABORATE,
    Permission.MATTERS_CREATE,
    Permission.MATTERS_READ,
    Permission.MATTERS_UPDATE,
    Permission.MATTERS_DELETE,
    Permission.MATTERS_ASSIGN,
  ],
  [Role.RESEARCHER]: [
    Permission.RESEARCH_QUERY,
    Permission.RESEARCH_HISTORY_READ,
    Permission.RESEARCH_EXPORT,
    Permission.LIBRARY_READ,
    Permission.LIBRARY_SEARCH,
    Permission.LIBRARY_BOOKMARK,
    Permission.LIBRARY_DOWNLOAD,
    Permission.DOCUMENTS_UPLOAD,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_ANALYZE,
    Permission.DRAFTS_CREATE,
    Permission.DRAFTS_READ,
    Permission.DRAFTS_UPDATE,
    Permission.DRAFTS_EXPORT,
  ],
  [Role.STUDENT]: [
    Permission.RESEARCH_QUERY,
    Permission.RESEARCH_HISTORY_READ,
    Permission.LIBRARY_READ,
    Permission.LIBRARY_SEARCH,
    Permission.LIBRARY_BOOKMARK,
  ],
  [Role.PUBLIC_USER]: [
    Permission.RESEARCH_QUERY,
    Permission.LIBRARY_READ,
    Permission.LIBRARY_SEARCH,
  ],
};