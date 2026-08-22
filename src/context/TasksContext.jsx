import React, { createContext, useContext } from 'react';

export const TasksContext = createContext();

export const useTasksContext = () => useContext(TasksContext);
