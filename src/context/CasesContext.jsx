import React, { createContext, useContext } from 'react';

export const CasesContext = createContext();

export const useCasesContext = () => useContext(CasesContext);
