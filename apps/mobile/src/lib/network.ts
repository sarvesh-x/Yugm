import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function init() {
      try {
        const state = await NetInfo.fetch();
        setIsOnline(state.isConnected ?? true);
        unsubscribe = NetInfo.addEventListener((s) => {
          setIsOnline(s.isConnected ?? true);
        });
      } catch {
        // netinfo not available, assume online
      }
    }
    init();
    return () => unsubscribe?.();
  }, []);
  return isOnline;
}
