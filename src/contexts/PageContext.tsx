// src/contexts/PageContext.tsx
"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

// Type definition for the context's state and functions
interface PageContextType {
  isSearchFilterVisible: boolean;
  setSearchFilterVisible: React.Dispatch<React.SetStateAction<boolean>>;
  // A function to handle the "Create" action, which will be defined by the active page
  handleCreateClick: () => void;
  // A function for the active page to register its specific "Create" action
  setHandleCreateClick: (fn: () => void) => void;
}

// Create the context with an undefined initial value
const PageContext = createContext<PageContextType | undefined>(undefined);

// The provider component that will wrap parts of our app
export const PageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSearchFilterVisible, setSearchFilterVisible] = useState(false);
  
  // State to hold the current page's "Create" action handler
  const [createHandler, setCreateHandler] = useState<() => void>(() => () => console.log("Default create handler called."));

  // useCallback to memoize the function that sets the handler
  const setHandleCreateClick = useCallback((fn: () => void) => {
    setCreateHandler(() => fn);
  }, []);

  return (
    <PageContext.Provider 
      value={{ 
        isSearchFilterVisible, 
        setSearchFilterVisible, 
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
