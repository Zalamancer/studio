// src/contexts/PageContext.tsx
"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

// Type definition for the context's state and functions
interface PageContextType {
  isSearchOverlayVisible: boolean;
  setSearchOverlayVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isFilterViewVisible: boolean;
  setFilterViewVisible: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  handleCreateClick: () => void;
  setHandleCreateClick: (fn: () => void) => void;
}

// Create the context with an undefined initial value
const PageContext = createContext<PageContextType | undefined>(undefined);

// The provider component that will wrap parts of our app
export const PageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSearchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [isFilterViewVisible, setFilterViewVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [createHandler, setCreateHandler] = useState<() => void>(() => () => console.log("Default create handler called."));

  const setHandleCreateClick = useCallback((fn: () => void) => {
    setCreateHandler(() => fn);
  }, []);

  return (
    <PageContext.Provider 
      value={{ 
        isSearchOverlayVisible, 
        setSearchOverlayVisible,
        isFilterViewVisible,
        setFilterViewVisible,
        searchTerm,
        setSearchTerm,
        handleCreateClick: createHandler, 
        setHandleCreateClick 
      }}
    >
      {children}
    </PageContext.Provider>
  );
};

// Custom hook to easily consume the context
export const usePage = (): PageContextType => {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
};
