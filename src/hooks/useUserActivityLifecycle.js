import { useEffect } from "react";
import {
  startUserActivityLifecycle,
  stopUserActivityLifecycle,
} from "@/services/UserActivityService";

export function useUserActivityLifecycle(isAuthenticated) {
  useEffect(() => {
    if (!isAuthenticated) {
      stopUserActivityLifecycle();
      return undefined;
    }
    return startUserActivityLifecycle();
  }, [isAuthenticated]);
}
