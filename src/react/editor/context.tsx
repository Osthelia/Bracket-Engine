import { createContext, useContext, useMemo, type ComponentType, type ReactElement, type ReactNode } from "react";
import { resolveLabels, type BracketLabels, type DeepPartial } from "../labels";
import type { EditorLabels } from "../labels";

// The editor does not ship its own form controls, the host passes the ones of its design system.
// Each one needs the props below, extra props of the host component are fine.
export interface EditorUi {
  Button: ComponentType<{
    type?: "button" | "submit";
    variant?: "default" | "outline";
    size?: "default" | "sm";
    disabled?: boolean;
    onClick?: () => void;
    children?: ReactNode;
  }>;
  Input: ComponentType<{
    id?: string;
    value?: string;
    inputMode?: "numeric" | "text";
    "aria-invalid"?: boolean;
    onChange?: (event: { target: { value: string } }) => void;
  }>;
  Select: ComponentType<{
    id?: string;
    value: string;
    onValueChange: (value: string) => void;
    options: readonly { value: string; label: string }[];
    placeholder?: string | undefined;
    invalid?: boolean;
  }>;
  Checkbox: ComponentType<{ checked?: boolean; onCheckedChange?: (checked: boolean) => void }>;
  Popover: ComponentType<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }>;
  PopoverTrigger: ComponentType<{ className?: string; render?: ReactElement; children?: ReactNode }>;
  PopoverContent: ComponentType<{ className?: string; children?: ReactNode }>;
  ConfirmDialog: ComponentType<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
  }>;
  Spinner: ComponentType<{ className?: string }>;
}

export interface EditorEnv {
  ui: EditorUi;
  labels: EditorLabels;
  // Name of a generated match from its key
  matchName: (key: string, params: Record<string, number>) => string;
}

export const EditorEnvContext = createContext<EditorEnv | null>(null);

export function useEditorEnv(): EditorEnv {
  const env = useContext(EditorEnvContext);
  if (!env) throw new Error("Editor parts must be rendered inside an EditorProvider");
  return env;
}

export interface EditorProviderProps {
  // Form controls of the host design system
  ui: EditorUi;
  labels?: DeepPartial<BracketLabels["editor"]> | undefined;
  // Name of a generated match from its key, defaults to the English names
  matchName?: ((key: string, params: Record<string, number>) => string) | undefined;
  children?: ReactNode;
}

// Gives the editor parts (the editor itself, the slot source control) their form controls and texts
export function EditorProvider({ ui, labels, matchName, children }: EditorProviderProps) {
  const env = useMemo<EditorEnv>(() => {
    const all = resolveLabels({ editor: labels });
    return { ui, labels: all.editor, matchName: matchName ?? all.viewer.matchName };
  }, [ui, labels, matchName]);
  return <EditorEnvContext.Provider value={env}>{children}</EditorEnvContext.Provider>;
}
