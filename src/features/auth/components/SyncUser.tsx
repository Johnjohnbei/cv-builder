import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { writeStoredText } from "@/src/shared/lib/storage";

export function SyncUser() {
  const { user } = useUser();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (!user) return;
    // Signed in: this tab is no longer a guest session. Left in place, the
    // guest flag kept routing parts of the app to the local guest data.
    writeStoredText('guest_access', '', 'session');
    storeUser().catch((e) => console.error('[SyncUser] storeUser failed:', e));
  }, [user, storeUser]);

  return null;
}
