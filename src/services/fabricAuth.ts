import { useCallback, useEffect, useState } from 'react';
import {
  ensureSignedInWithFabric,
  initEmbeddedAuth,
  type FabricAuthOptions,
} from '@microsoft/rayfin-auth-provider-fabric';
import { getRayfinAuth, isMockMode } from './rayfinClient';

/**
 * Auth lifecycle states for the Fabric-hosted backend.
 *  - mock           → running the in-browser simulator, no auth needed
 *  - pending        → resolving an existing/embedded session
 *  - authenticated  → signed in, entity reads will succeed
 *  - signin-required→ needs a user gesture to open the Fabric broker
 *  - error          → sign-in attempt failed
 */
export type AuthState =
  | 'mock'
  | 'pending'
  | 'authenticated'
  | 'signin-required'
  | 'error';

function fabricOptions(): FabricAuthOptions | null {
  const workspaceId = import.meta.env.VITE_FABRIC_WORKSPACE_ID;
  const projectId = import.meta.env.VITE_FABRIC_ITEM_ID;
  const fabricPortalUrl =
    import.meta.env.VITE_FABRIC_PORTAL_URL || 'https://app.fabric.microsoft.com';
  if (!workspaceId || !projectId) return null;
  return {
    workspaceId,
    projectId,
    fabricPortalUrl,
    returnOrigin: window.location.origin,
  };
}

/**
 * Drives Fabric brokered (SSO) authentication for the deployed backend.
 *
 * On startup it attempts a no-popup resume (embedded iframe handoff or an
 * existing/refreshable session). If that fails, it surfaces `signin-required`
 * so the UI can render a button that calls `signIn()` from a user gesture
 * (required to avoid popup blockers).
 */
export function useFabricAuth() {
  const [state, setState] = useState<AuthState>(() =>
    isMockMode() ? 'mock' : 'pending'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isMockMode()) return;
    const auth = getRayfinAuth();
    const opts = fabricOptions();
    // No Fabric config (e.g. local dev against an open API) → let polling try.
    if (!auth || !opts) {
      setState('authenticated');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await initEmbeddedAuth(auth, opts);
      } catch (err) {
        console.warn('[auth] embedded init failed', err);
      }
      if (cancelled) return;
      setState(
        auth.getSession().isAuthenticated ? 'authenticated' : 'signin-required'
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const auth = getRayfinAuth();
    const opts = fabricOptions();
    if (!auth || !opts) return;
    setError(null);
    setState('pending');
    try {
      await ensureSignedInWithFabric(auth, opts);
      setState('authenticated');
    } catch (err) {
      console.error('[auth] sign-in failed', err);
      setError(err instanceof Error ? err.message : String(err));
      setState('signin-required');
    }
  }, []);

  return { state, error, signIn };
}
