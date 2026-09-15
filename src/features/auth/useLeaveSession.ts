import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { writeStoredText } from '@/src/shared/lib/storage';

/**
 * End the current session, account or guest, and go back to the sign-in page.
 *
 * One owner for "leave": sign-out used to keep the guest flag, so the tab went
 * on as a guest session, and a guest had no way out of guest mode at all.
 */
export function useLeaveSession() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  return useCallback(async () => {
    writeStoredText('guest_access', '', 'session');
    try {
      await signOut();
    } catch (e) {
      console.error('[auth] sign-out failed:', e);
    }
    navigate('/auth');
  }, [signOut, navigate]);
}
