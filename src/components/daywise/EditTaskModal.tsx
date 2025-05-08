
'use client';

import type { Task } from '@/app/page';
import TaskForm from './TaskForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { format, parseISO } from 'date-fns';


interface EditTaskModalProps {
  task: Task;
  onSave: (updatedTask: Task) => void;
  onClose: () => void;
}

export default function EditTaskModal({ task, onSave, onClose }: EditTaskModalProps) {
  
  const initialFormValues = {
    description: task.description,
    estimatedTime: task.estimatedTime,
    category: task.category || '',
    scheduledDate: task.scheduledDate ? parseISO(task.scheduledDate) : undefined,
    notes: task.notes || '',
  };
  
  const handleSave = (formData: Omit<Task, 'id' | 'completed' | 'actualTimeSpent' | 'timerState' | 'completedAt' | 'failed' | 'subTasks'>) => {
    const updatedTask: Task = {
      ...task, // Retain existing fields like id, completed, actualTimeSpent, etc.
      description: formData.description,
      estimatedTime: formData.estimatedTime,
      category: formData.category,
      scheduledDate: formData.scheduledDate, // This will be stringified by TaskForm
      notes: formData.notes,
    };
    onSave(updatedTask);
  };

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Task: {task.description.substring(0,30)}{task.description.length > 30 && "..."}</DialogTitle>
          <DialogDescription>
            Update the details for this task. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <TaskForm 
                onSubmit={handleSave} 
                initialData={initialFormValues} 
                isEditMode={true}
            />
        </div>
        {/* TaskForm now includes the submit button, so no need for DialogFooter buttons here unless for 'Cancel' */}
        {/* <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
}
