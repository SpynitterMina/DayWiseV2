
'use client';

import type { Task } from '@/app/page';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Clock3, CheckCircle2, Play, Pause, RotateCcw, TimerIcon, GripVertical, CalendarClock, Tag, PlusSquare, Save, X, Edit, CornerDownRight, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';

interface TaskListProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>; 
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onTimerAction: (taskId: string, action: 'start' | 'pause' | 'reset') => void;
  activeTimerTaskId: string | null;
  onAddManualTime: (taskId: string, timeInMinutes: number) => void;
  onEditTask: (task: Task) => void;
  onAddSubTask: (parentId: string, subTaskData: Omit<Task, 'id' | 'completed' | 'actualTimeSpent' | 'timerState' | 'completedAt' | 'failed' | 'subTasks' | 'notes'>) => void;
  onToggleSubTask: (parentId: string, subTaskId: string) => void;
  onDeleteSubTask: (parentId: string, subTaskId: string) => void;
}

export default function TaskList({ 
    tasks, setTasks, onToggle, onDelete, onTimerAction, activeTimerTaskId, onAddManualTime, onEditTask,
    onAddSubTask, onToggleSubTask, onDeleteSubTask 
}: TaskListProps) {
  const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null);
  const [manualTimeInputValue, setManualTimeInputValue] = useState<string>('');
  const [addingSubTaskId, setAddingSubTaskId] = useState<string | null>(null);
  const [subTaskDescription, setSubTaskDescription] = useState('');
  const [subTaskEstTime, setSubTaskEstTime] = useState<string>('15');
  const [expandedNotesTaskId, setExpandedNotesTaskId] = useState<string | null>(null);

  const { toast } = useToast();
  
  const formatTimeDigital = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatEstimatedTime = (minutes: number) => {
    if (minutes < 0) minutes = 0;
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  const handleOpenManualTimeInput = (taskId: string) => {
    setEditingTimeTaskId(taskId);
    setManualTimeInputValue('');
  };

  const handleSaveManualTime = (taskId: string) => {
    const timeInMinutes = parseInt(manualTimeInputValue, 10);
    if (isNaN(timeInMinutes) || timeInMinutes <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a positive number for minutes.", variant: "destructive"});
      return;
    }
    onAddManualTime(taskId, timeInMinutes);
    setEditingTimeTaskId(null);
    setManualTimeInputValue('');
  };

  const handleAddSubTaskSubmit = (parentId: string) => {
    if (!subTaskDescription.trim()) {
        toast({ title: "Sub-task description needed", variant: "destructive" });
        return;
    }
    const estTimeNum = parseInt(subTaskEstTime, 10);
    if (isNaN(estTimeNum) || estTimeNum <= 0) {
        toast({ title: "Invalid estimated time for sub-task", variant: "destructive" });
        return;
    }
    onAddSubTask(parentId, { description: subTaskDescription, estimatedTime: estTimeNum });
    setSubTaskDescription('');
    setSubTaskEstTime('15');
    setAddingSubTaskId(null);
  };

  const toggleNotes = (taskId: string) => {
    setExpandedNotesTaskId(prev => prev === taskId ? null : taskId);
  };
  
  return (
    <ScrollArea className="h-full pr-4 -mr-4"> 
      <Reorder.Group axis="y" values={tasks} onReorder={setTasks} className="space-y-4">
        <AnimatePresence>
          {tasks.map((task, index) => {
            const estimatedTimeInSeconds = (task.estimatedTime || 0) * 60;
            const remainingTimeInSeconds = estimatedTimeInSeconds - task.actualTimeSpent;
            const isTimerActiveForThisTask = activeTimerTaskId === task.id && task.timerState === 'running';
            const isThisTaskPaused = task.timerState === 'paused';
            const isAnotherTaskActive = activeTimerTaskId !== null && activeTimerTaskId !== task.id;

            let dueDateStatus = '';
            let dueDateColor = 'text-muted-foreground';
            if (task.scheduledDate) {
              const due = parseISO(task.scheduledDate);
              if (task.completed) {
                dueDateStatus = `Completed`;
                if (task.completedAt) {
                    dueDateStatus += ` ${formatDistanceToNowStrict(parseISO(task.completedAt), { addSuffix: true })}`;
                }
                dueDateColor = 'text-green-600';
              } else if (task.failed) {
                dueDateStatus = `Overdue since ${format(due, 'MMM d')}`;
                dueDateColor = 'text-red-600 font-semibold';
              } else {
                dueDateStatus = `Due ${format(due, 'MMM d')}`;
              }
            }


            return (
              <Reorder.Item
                key={task.id}
                value={task}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, transition: { duration: 0.3 } }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 120, delay: index * 0.05 }}
                className="list-none" 
              >
                <Card className={`transition-all duration-300 ease-in-out hover:shadow-lg 
                  ${task.failed ? 'bg-red-500/10 border-red-500/50' : task.completed ? 'bg-muted/50 border-green-500/50' : 'bg-card'} 
                  ${isTimerActiveForThisTask ? 'ring-2 ring-primary shadow-primary/30' : ''}
                  cursor-grab active:cursor-grabbing`}
                >
                  <CardContent className="p-4 flex flex-col space-y-3">
                    <div className="flex items-start space-x-3">
                       <div className="flex-shrink-0 pt-1 text-muted-foreground hover:text-foreground">
                         <GripVertical size={20} />
                       </div>
                      <div className="flex items-center pt-1">
                        <Checkbox
                          id={`task-${task.id}`}
                          checked={task.completed}
                          onCheckedChange={() => onToggle(task.id)}
                          aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
                          className={`h-5 w-5 rounded-full data-[state=checked]:bg-green-500 data-[state=checked]:border-green-600 border-primary ${task.failed ? 'border-red-500 data-[state=checked]:bg-red-400 data-[state=checked]:border-red-500' : ''}`}
                          disabled={task.timerState === 'running'}
                        />
                      </div>
                      <div className="flex-grow">
                        <label
                          htmlFor={`task-${task.id}`}
                          className={`block text-md font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'} ${task.failed ? 'text-red-700' : ''}`}
                        >
                          {task.description}
                        </label>
                        <div className="flex flex-wrap items-center text-xs text-muted-foreground mt-1 space-x-3">
                          <div className="flex items-center">
                            <Clock3 size={14} className="mr-1 text-primary" />
                            <span>Est: {formatEstimatedTime(task.estimatedTime)}</span>
                          </div>
                          {task.category && (
                            <div className="flex items-center">
                              <Tag size={14} className="mr-1 text-purple-500" />
                              <span>{task.category}</span>
                            </div>
                          )}
                          {task.scheduledDate && (
                            <div className={`flex items-center ${dueDateColor}`}>
                              <CalendarClock size={14} className="mr-1" />
                              <span>{dueDateStatus}</span>
                            </div>
                          )}
                          {task.completed && !task.failed && <CheckCircle2 size={14} className="text-green-500" />}
                          {task.failed && <Badge variant="destructive" className="text-xs">FAILED</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => onEditTask(task)} aria-label="Edit task" className="text-muted-foreground hover:text-primary flex-shrink-0 h-8 w-8">
                            <Edit size={16}/>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} aria-label="Delete task" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0 h-8 w-8">
                            <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                    
                    {task.notes && (
                        <div className="pl-10">
                             <Button variant="link" size="sm" onClick={() => toggleNotes(task.id)} className="px-0 py-0 h-auto text-xs text-accent hover:text-accent/80">
                                {expandedNotesTaskId === task.id ? <ChevronUp size={14} className="mr-1"/> : <ChevronDown size={14} className="mr-1"/>}
                                {expandedNotesTaskId === task.id ? 'Hide Notes' : 'Show Notes'}
                            </Button>
                            <AnimatePresence>
                            {expandedNotesTaskId === task.id && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded-md whitespace-pre-wrap mt-1"
                                >
                                    {task.notes}
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>
                    )}

                    {!task.completed && !task.failed && (
                      <div className="pl-10 flex flex-col space-y-2 pt-2 border-t border-dashed mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <TimerIcon size={18} className={`${isTimerActiveForThisTask ? 'text-primary animate-pulse' : isThisTaskPaused ? 'text-amber-500' : 'text-muted-foreground'}`} />
                            <div className="flex flex-col">
                               <span className={`text-sm font-medium ${isTimerActiveForThisTask ? 'text-primary' : 'text-foreground'}`}>
                                {formatTimeDigital(task.actualTimeSpent)}
                               </span>
                               <span className={`text-xs ${remainingTimeInSeconds < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {remainingTimeInSeconds >= 0 ? `${formatTimeDigital(remainingTimeInSeconds)} left` : `${formatTimeDigital(Math.abs(remainingTimeInSeconds))} over`}
                               </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            {task.timerState === 'running' ? (
                              <Button variant="outline" size="sm" onClick={() => onTimerAction(task.id, 'pause')} aria-label="Pause timer">
                                <Pause size={16} className="mr-0 sm:mr-1" /> <span className="hidden sm:inline">Pause</span>
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onTimerAction(task.id, 'start')} 
                                disabled={isAnotherTaskActive}
                                aria-label="Start timer"
                              >
                                <Play size={16} className="mr-0 sm:mr-1" /> <span className="hidden sm:inline">Start</span>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => onTimerAction(task.id, 'reset')} 
                              disabled={task.timerState === 'running'}
                              aria-label="Reset timer"
                              className="text-muted-foreground hover:text-foreground h-8 w-8"
                            >
                              <RotateCcw size={16} />
                            </Button>
                          </div>
                        </div>
                        {editingTimeTaskId === task.id ? (
                          <div className="flex items-center space-x-2">
                            <Input 
                              type="number"
                              value={manualTimeInputValue}
                              onChange={(e) => setManualTimeInputValue(e.target.value)}
                              placeholder="Mins"
                              className="h-8 w-20 text-sm"
                              min="1"
                            />
                            <Button size="sm" onClick={() => handleSaveManualTime(task.id)} className="h-8">
                              <Save size={14} className="mr-1"/> Save
                            </Button>
                             <Button variant="ghost" size="icon" onClick={() => setEditingTimeTaskId(null)} className="h-8 w-8">
                              <X size={14}/>
                            </Button>
                          </div>
                        ) : (
                           <Button variant="outline" size="sm" onClick={() => handleOpenManualTimeInput(task.id)} className="w-full sm:w-auto self-start">
                             <PlusSquare size={16} className="mr-2"/> Add Manual Time
                           </Button>
                        )}

                        {/* Sub-task Section */}
                        <div className="space-y-2">
                            {(task.subTasks || []).map(subTask => (
                                <div key={subTask.id} className="flex items-center space-x-2 pl-4 border-l-2 border-primary/30 ml-2 py-1">
                                    <Checkbox
                                        id={`subtask-${subTask.id}`}
                                        checked={subTask.completed}
                                        onCheckedChange={() => onToggleSubTask(task.id, subTask.id)}
                                        className="h-4 w-4"
                                    />
                                    <label htmlFor={`subtask-${subTask.id}`} className={`text-xs flex-grow ${subTask.completed ? 'line-through text-muted-foreground' : ''}`}>
                                        {subTask.description} ({formatEstimatedTime(subTask.estimatedTime)})
                                    </label>
                                    <Button variant="ghost" size="icon" onClick={() => onDeleteSubTask(task.id, subTask.id)} className="h-6 w-6 text-destructive/60 hover:text-destructive">
                                        <Trash2 size={12} />
                                    </Button>
                                </div>
                            ))}
                            {addingSubTaskId === task.id ? (
                                <div className="pl-4 border-l-2 border-primary/30 ml-2 py-2 space-y-2">
                                    <Input 
                                        value={subTaskDescription} 
                                        onChange={(e) => setSubTaskDescription(e.target.value)} 
                                        placeholder="New sub-task description"
                                        className="h-8 text-xs"
                                    />
                                    <div className="flex items-center space-x-2">
                                        <Input 
                                            type="number"
                                            value={subTaskEstTime}
                                            onChange={(e) => setSubTaskEstTime(e.target.value)}
                                            placeholder="Est. mins"
                                            className="h-8 text-xs w-20"
                                        />
                                        <Button size="sm" onClick={() => handleAddSubTaskSubmit(task.id)} className="h-8 text-xs">Add</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setAddingSubTaskId(null)} className="h-8 text-xs">Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => { setAddingSubTaskId(task.id); setSubTaskDescription(''); setSubTaskEstTime('15');}} className="mt-1 text-xs self-start ml-6">
                                    <CornerDownRight size={14} className="mr-1"/> Add Sub-task
                                </Button>
                            )}
                        </div>

                      </div>
                    )}
                    {task.completed && task.actualTimeSpent > 0 && !task.failed && (
                       <div className="pl-10 text-sm text-muted-foreground pt-2 border-t border-dashed mt-2">
                          Completed in: {formatTimeDigital(task.actualTimeSpent)}
                       </div>
                    )}
                  </CardContent>
                </Card>
              </Reorder.Item>
            )
          })}
        </AnimatePresence>
      </Reorder.Group>
    </ScrollArea>
  );
}
