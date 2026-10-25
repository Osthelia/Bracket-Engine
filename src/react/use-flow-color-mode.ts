import { useEffect, useState } from "react";

// "system" resolves differently on the server and the client, so it is only used after mount
export function useFlowColorMode(): "light" | "system" {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? "system" : "light";
}
