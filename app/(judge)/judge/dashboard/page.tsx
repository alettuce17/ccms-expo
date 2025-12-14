'/app/%28judge%29/judge/dashboard/page.tsx'

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ChevronRight, CheckCircle, Circle, Clock, LogOut } from 'lucide-react';
import type { Participant, Score, Competition, Judge } from '@/types/expo';

export default function JudgeDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  // State
  const [judge, setJudge] = useState<Judge | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myScores, setMyScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [boothCodeInput, setBoothCodeInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
        // 1. Get Judge ID from Session
        const storedJudgeId = localStorage.getItem('ccms_judge_id');
        if (!storedJudgeId) {
            router.push('/login');
            return;
        }

        // 2. Fetch Judge Details (to get assigned competition)
        const { data: judgeData } = await supabase
            .from('judges')
            .select('*')
            .eq('judge_id', storedJudgeId)
            .single();

        if (!judgeData) {
            alert("Judge profile not found. Please log in again.");
            localStorage.removeItem('ccms_judge_id');
            router.push('/login');
            return;
        }
        setJudge(judgeData);

        // 3. Fetch Assigned Competition
        const { data: compData } = await supabase
            .from('competitions')
            .select('*')
            .eq('competition_id', judgeData.competition_id)
            .single();
        setCompetition(compData);

        // 4. Fetch Participants for this specific track
        const { data: teams } = await supabase
            .from('participants')
            .select('*')
            .eq('competition_id', judgeData.competition_id)
            .order('booth_code');
        if (teams) setParticipants(teams);
        
        // 5. Fetch My Scores (to determine status)
        const { data: scores } = await supabase
            .from('scores')
            .select('*')
            .eq('judge_id', storedJudgeId);
        if (scores) setMyScores(scores);

        setLoading(false);
    };

    init();
  }, [supabase, router]);

  // Handle Logout
  const handleLogout = () => {
      localStorage.removeItem('ccms_judge_id');
      localStorage.removeItem('ccms_judge_name');
      router.push('/login');
  };

  // Handle Manual Code Entry
  const handleEnterCode = () => {
    if (!boothCodeInput) return;
    const team = participants.find(p => p.booth_code === boothCodeInput.toUpperCase());
    
    if (team) {
        router.push(`/judge/vote/${team.participant_id}`);
    } else {
        setError('Invalid Code. Team not found in this track.');
    }
  };

  // Helper: Determine Status (Completed / In Progress / Pending)
  const getStatus = (participantId: number) => {
    const teamScores = myScores.filter(s => s.participant_id === participantId);
    if (teamScores.length === 0) return 'pending';
    
    // If any score row is locked, the whole evaluation is considered submitted
    const isLocked = teamScores.some(s => s.is_locked);
    return isLocked ? 'completed' : 'in-progress';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold">Loading Assignments...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-20">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black text-slate-900">Judge Panel</h1>
                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">{competition?.title || 'Loading...'}</p>
                <p className="text-xs text-slate-400 mt-1">Welcome, {judge?.name}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-2">
                <LogOut size={20} />
            </button>
        </div>

        {/* Quick Access / Scanner Simulation */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-300 space-y-3">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Enter Booth Code</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="e.g. GAME-01"
                    className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 uppercase tracking-widest font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                    value={boothCodeInput}
                    onChange={(e) => {
                        setBoothCodeInput(e.target.value);
                        setError('');
                    }}
                />
                <button 
                    onClick={handleEnterCode}
                    className="bg-blue-600 text-white px-5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
            {error && <p className="text-xs text-red-500 font-bold animate-pulse">{error}</p>}
        </div>

        {/* Participant List */}
        <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">Assigned Teams ({participants.length})</h2>
            
            {participants.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    No teams assigned to this track yet.
                </div>
            ) : (
                participants.map((team) => {
                    const status = getStatus(team.participant_id);
                    
                    let statusColor = "border-slate-300 hover:border-blue-400 bg-white";
                    let icon = <Circle size={24} className="text-slate-300" />;
                    let statusText = null;

                    if (status === 'completed') {
                        statusColor = "border-green-300 bg-green-50/50";
                        icon = <CheckCircle size={24} className="text-green-600 fill-green-100" />;
                        statusText = <span className="text-[10px] font-black text-green-700 uppercase tracking-wide bg-green-200 px-2 py-0.5 rounded-full">Completed</span>;
                    } else if (status === 'in-progress') {
                        statusColor = "border-amber-300 bg-amber-50/50";
                        icon = <Clock size={24} className="text-amber-500" />;
                        statusText = <span className="text-[10px] font-black text-amber-700 uppercase tracking-wide bg-amber-200 px-2 py-0.5 rounded-full">In Progress</span>;
                    }

                    return (
                        <div 
                            key={team.participant_id}
                            onClick={() => router.push(`/judge/vote/${team.participant_id}`)}
                            className={`group relative p-4 rounded-xl border-2 transition-all active:scale-95 cursor-pointer flex items-center justify-between shadow-sm ${statusColor}`}
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-bold font-mono bg-slate-800 text-white px-2 py-0.5 rounded">
                                        {team.booth_code}
                                    </span>
                                    {statusText}
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg leading-tight">{team.real_name}</h3>
                                <p className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-1">{team.alias || 'No alias'}</p>
                            </div>
                            
                            <div className="pl-4">
                                {icon}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>
    </div>
  );
}