"use client";

import { useCallback, useEffect, useState } from "react";
import { clearApiKey, readApiKey, writeApiKey, type ApiKeyState } from "@/lib/api-key";

export function useApiKey() {
  const [state, setState] = useState<ApiKeyState>({
    key: "",
    persist: true,
    source: "none",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(readApiKey());
    setLoaded(true);
  }, []);

  const save = useCallback((key: string, persist: boolean) => {
    setState(writeApiKey(key.trim(), persist));
  }, []);

  const clear = useCallback(() => {
    clearApiKey();
    setState({ key: "", persist: true, source: "none" });
  }, []);

  return { ...state, loaded, save, clear };
}
