import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export function useGeneralTasks() {
  const { globalTasks, saveGlobalTask, completeGlobalTask, deleteGlobalTask, currentUser } = useAppContext();
  const { showConfirm } = useUI();

  const completeTask = async (taskId, notes) => {
    const stringNotes = typeof notes === 'string' ? notes : '';
    return await completeGlobalTask(taskId, stringNotes);
  };

  const uncompleteTask = async (taskId) => {
    const task = globalTasks.find(t => t.id === taskId);
    if (!task) return false;
    return await saveGlobalTask({ ...task, status: 'pending', completedAt: null }, taskId);
  };

  const saveTask = async (taskData, taskId) => {
    if (taskId) {
      const existingTask = globalTasks.find(t => t.id === taskId);
      return await saveGlobalTask({ 
        ...existingTask, 
        ...taskData, 
        type: existingTask?.type || taskData.type || 'global',
        updatedAt: new Date().toISOString() 
      }, taskId);
    } else {
      return await saveGlobalTask({ 
        ...taskData, 
        type: taskData.type || 'global',
        status: 'pending', 
        createdAt: new Date().toISOString(),
        createdBy: taskData.createdBy || currentUser || 'مجهول'
      });
    }
  };

  const deleteTask = async (taskId, skipConfirm = false) => {
    if (!skipConfirm) {
      const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذه المهمة؟');
      if (!confirmed) return false;
    }
    return await deleteGlobalTask(taskId);
  };

  return { completeTask, uncompleteTask, saveTask, deleteTask };
}
