'use client';

import React, { useState, useEffect } from 'react';
// CORRECTED: Import the named export 'createClient' instead of default
import { createClient } from '@/lib/supabase'; 
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Circle, 
  Loader2, 
  Layout,
  AlertCircle 
} from 'lucide-react';

export default function TasksPage() {
  // Initialize the Supabase client for the browser
  const supabase = createClient();

  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Tasks
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      // Replace 'tasks' with your actual table name in Supabase
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          { 
            text: newTask.trim(), 
            completed: false, 
            // created_at is usually handled by default in Supabase
          }
        ])
        .select();

      if (error) throw error;

      if (data) {
        setTasks([data[0], ...tasks]);
        setNewTask('');
      }
    } catch (err: any) {
      console.error('Error adding task:', err);
      setError(err.message);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !currentStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, completed: !currentStatus } : t
      ));
    } catch (err: any) {
      console.error('Error updating task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err: any) {
      console.error('Error deleting task:', err);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-600 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-bold mb-2">Error</h2>
            <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Task Board</h1>
              <p className="text-slate-500 text-sm">Supabase Integration</p>
            </div>
          </div>
        </header>

        {/* Input Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 mb-6">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 bg-transparent border-none outline-none px-4 py-3"
            />
            <button
              type="submit"
              disabled={!newTask.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {loading ? (
             <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
             </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500">No tasks yet.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm ${
                  task.completed ? 'opacity-75 bg-slate-50' : ''
                }`}
              >
                <button
                  onClick={() => toggleTask(task.id, task.completed)}
                  className={`flex-shrink-0 ${
                    task.completed ? 'text-blue-500' : 'text-slate-300 hover:text-blue-500'
                  }`}
                >
                  {task.completed ? <CheckCircle /> : <Circle />}
                </button>
                
                <span className={`flex-1 ${task.completed ? 'line-through text-slate-400' : ''}`}>
                  {task.text}
                </span>

                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}