"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "akomapa:sidebar-collapsed";

interface SidebarContextValue {
  /** True only when the rail is both enabled and toggled closed. */
  collapsed: boolean;
  /** Whether this shell instance supports a collapsible rail at all. */
  collapsible: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  collapsible: false,
  toggle: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({
  collapsible,
  children,
}: {
  collapsible: boolean;
  children: React.ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!collapsible) return;
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, [collapsible]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{ collapsed: collapsible && collapsed, collapsible, toggle }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
