import { createContext, useContext, useState, type ReactNode } from "react";
import { defaultLabels, type ViewerLabels } from "../labels";
import type { BracketEntrantView } from "../../view/bracket-view";

export interface ViewerEnv {
  labels: ViewerLabels;
  // Wraps a match that has a link, so the host router can handle the navigation
  renderLink: (props: { href: string; className: string; children: ReactNode }) => ReactNode;
  // Logo of an entrant, the default shows the first letter when there is no image
  renderLogo: (entrant: BracketEntrantView, className: string) => ReactNode;
}

function LogoImage({ src, className, fallback }: { src: string; className: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`shrink-0 object-cover ${className}`} />;
}

export function EntrantLogo({ entrant, className }: { entrant: BracketEntrantView; className: string }) {
  const initial = entrant.name.trim().charAt(0).toUpperCase() || "?";
  const fallback = (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground ${className}`}>
      {initial}
    </span>
  );
  if (!entrant.logoUrl) return fallback;
  return <LogoImage src={entrant.logoUrl} className={className} fallback={fallback} />;
}

export const defaultViewerEnv: ViewerEnv = {
  labels: defaultLabels.viewer,
  renderLink: ({ href, className, children }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  renderLogo: (entrant, className) => <EntrantLogo entrant={entrant} className={className} />,
};

export const ViewerEnvContext = createContext<ViewerEnv>(defaultViewerEnv);
export const useViewerEnv = () => useContext(ViewerEnvContext);
