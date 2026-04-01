import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

export function SyncUser() {
  const { user } = useUser();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (user) {
      storeUser();
    }
  }, [user, storeUser]);

  return null;
}
