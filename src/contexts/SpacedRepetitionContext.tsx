
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { format, addDays, differenceInCalendarDays, parseISO, isSameDay, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export interface SpacedRepetitionTask {
  id: string;
  title: string;
  content?: string; 
  firstReviewDate: string; // Initial date set for the very first review
  lastReviewedDate?: string; // Date of the most recent review
  nextReviewDate: string; // Date for the upcoming review
  difficulty?: 'easy' | 'medium' | 'hard'; // Difficulty of the last review
  currentIntervalDays: number; // The interval (in days) that led to the current next_review_date
  timesReviewed: number; // How many times this item has been reviewed
  createdAt: string; // When the item was first created
  status?: 'new' | 'learning' | 'graduated'; // Optional status
}

interface SpacedRepetitionContextType {
  tasks: SpacedRepetitionTask[];
  addTask: (taskData: Omit<SpacedRepetitionTask, 'id' | 'nextReviewDate' | 'currentIntervalDays' | 'timesReviewed' | 'createdAt' | 'status'>) => void;
  updateTask: (taskId: string, updates: Partial<Omit<SpacedRepetitionTask, 'id' | 'createdAt'>>) => void;
  deleteTask: (taskId: string) => void;
  markAsReviewed: (taskId: string, difficulty: 'easy' | 'medium' | 'hard') => void;
  getTasksForDate: (date: Date) => SpacedRepetitionTask[];
}

const SpacedRepetitionContext = createContext<SpacedRepetitionContextType | undefined>(undefined);

const SR_TASKS_STORAGE_KEY = 'daywiseSRTasks_v4'; // Incremented version

const calculateNextReviewDetails = (
  currentIntervalDays: number,
  difficulty: 'easy' | 'medium' | 'hard',
  isItemNew: boolean
): { newCalculatedIntervalDays: number; nextReviewDate: string } => {
  const currentDate = new Date();
  let newCalculatedIntervalDays: number;

  if (isItemNew) {
    if (difficulty === 'hard') newCalculatedIntervalDays = 1;
    else if (difficulty === 'medium') newCalculatedIntervalDays = 2;
    else newCalculatedIntervalDays = 7; // easy
  } else {
    const PI = currentIntervalDays;
    if (difficulty === 'hard') {
      if (PI > 7) { // Lapse handling
        newCalculatedIntervalDays = 2;
      } else {
        newCalculatedIntervalDays = Math.round(PI * 2.0);
      }
    } else if (difficulty === 'medium') {
      newCalculatedIntervalDays = Math.round(PI * 3.0);
    } else { // easy
      newCalculatedIntervalDays = Math.round(PI * 3.3);
    }
  }

  newCalculatedIntervalDays = Math.max(1, newCalculatedIntervalDays); // Ensure minimum interval of 1 day
  newCalculatedIntervalDays = Math.min(newCalculatedIntervalDays, 365); // Cap interval at 1 year

  const nextReviewDate = format(addDays(currentDate, newCalculatedIntervalDays), 'yyyy-MM-dd');
  return { newCalculatedIntervalDays, nextReviewDate };
};


export const SpacedRepetitionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<SpacedRepetitionTask[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTasks = localStorage.getItem(SR_TASKS_STORAGE_KEY);
      if (storedTasks) {
        try {
          setTasks(JSON.parse(storedTasks));
        } catch (e) {
          console.error("Failed to parse SR tasks from localStorage", e);
          localStorage.removeItem(SR_TASKS_STORAGE_KEY);
        }
      }
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem(SR_TASKS_STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, isInitialized]);

  const addTask = useCallback((taskData: Omit<SpacedRepetitionTask, 'id' | 'nextReviewDate' | 'currentIntervalDays' | 'timesReviewed' | 'createdAt'| 'status'>) => {
    const newTask: SpacedRepetitionTask = {
      ...taskData,
      id: `sr_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      nextReviewDate: taskData.firstReviewDate, 
      currentIntervalDays: 0, // New items start with 0 interval before first "real" review
      timesReviewed: 0,
      createdAt: new Date().toISOString(),
      status: 'new',
    };
    setTasks(prev => [...prev, newTask].sort((a,b) => a.nextReviewDate.localeCompare(b.nextReviewDate)));
    toast({ title: "Review Item Added", description: `"${taskData.title}" scheduled for initial review.`});
  }, [toast]);

  const updateTask = useCallback((taskId: string, updates: Partial<Omit<SpacedRepetitionTask, 'id' | 'createdAt'>>) => {
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task)
                        .sort((a,b) => a.nextReviewDate.localeCompare(b.nextReviewDate)));
    toast({ title: "Review Item Updated", description: "Changes saved."});
  }, [toast]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    toast({ title: "Review Item Deleted", variant: "destructive"});
  }, [toast]);

  const markAsReviewed = useCallback((taskId: string, difficulty: 'easy' | 'medium' | 'hard') => {
    setTasks(prev => {
      const taskIndex = prev.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;

      const task = prev[taskIndex];
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      const isItemNew = task.status === 'new' || task.timesReviewed === 0;
      const { newCalculatedIntervalDays, nextReviewDate: newNextReviewDate } = calculateNextReviewDetails(
        task.currentIntervalDays,
        difficulty,
        isItemNew
      );

      const updatedTask: SpacedRepetitionTask = {
        ...task,
        lastReviewedDate: todayStr,
        nextReviewDate: newNextReviewDate,
        difficulty,
        currentIntervalDays: newCalculatedIntervalDays,
        timesReviewed: task.timesReviewed + 1,
        status: 'learning', // Item is now in learning phase
      };
      
      const newTasks = [...prev];
      newTasks[taskIndex] = updatedTask;
      
      toast({
        title: "Item Reviewed!",
        description: `"${task.title}" next review in ${newCalculatedIntervalDays} day(s) on ${format(parseISO(newNextReviewDate), 'PPP')}.`
      });
      return newTasks.sort((a,b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
    });
  }, [toast]);

  const getTasksForDate = useCallback((date: Date): SpacedRepetitionTask[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      try {
        return isSameDay(parseISO(task.nextReviewDate), parseISO(dateStr));
      } catch (e) {
        console.warn("Error parsing date in getTasksForDate:", task.nextReviewDate, dateStr);
        return false;
      }
    });
  }, [tasks]);

  return (
    <SpacedRepetitionContext.Provider value={{ tasks, addTask, updateTask, deleteTask, markAsReviewed, getTasksForDate }}>
      {children}
    </SpacedRepetitionContext.Provider>
  );
};

export const useSpacedRepetition = (): SpacedRepetitionContextType => {
  const context = useContext(SpacedRepetitionContext);
  if (context === undefined) {
    throw new Error('useSpacedRepetition must be used within a SpacedRepetitionProvider');
  }
  return context;
};

