import { useQuery } from '@tanstack/react-query';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';

/**
 * The single source of truth for the caller's workspace.
 *
 * Three components used to run this query independently with inconsistent
 * semantics — one optimistic, two positive — which meant a user with no
 * workspace still saw owner-only navigation. Everything reads from here now.
 *
 * `needsAccess` is the new state: signed in, but not linked to any workspace.
 * The server reports it as 403 WORKSPACE_REQUIRED.
 */
export function useWorkspace() {
  const query = useQuery({
    queryKey: ['workspace', 'context'],
    queryFn: workspaceApi.context,
    // A 403 here is a real answer, not a transient failure — don't hammer it.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const workspace = query.data ?? null;
  const role = workspace?.role ?? null;
  const needsAccess = query.isError && toApiError(query.error).code === 'WORKSPACE_REQUIRED';

  return {
    workspace,
    role,
    hasWorkspace: Boolean(workspace),
    isOwner: role === 'owner',
    // Gate POSITIVELY: only a confirmed owner/admin, never "still loading".
    isWorkspaceAdmin: role === 'owner' || role === 'admin',
    needsAccess,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export default useWorkspace;
