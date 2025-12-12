// DIRECTORY LOCATION: app/(public)/scoreboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Trophy, Medal, Crown } from 'lucide-react';

// Simplified Types for Scoreboard
type RankedTeam = {
    id: number;
    name: string;
    alias: string;
    score: number;
    rank: number;
};

type Track = {
    id: number;
    title: string;
};

export default function ScoreboardPage() {
  const supabase = createClient();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<number>(0);
  const [rankings, setRankings] = useState<RankedTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Initial Load: Get Tracks
  useEffect(() => {
    const fetchTracks = async () => {
        const { data } = await supabase.from('competitions').select('competition_id, title').eq('status', 'live');
        if (data && data.length > 0) {
            const mapped = data.map(d => ({ id: d.competition_id, title: d.title }));
            setTracks(mapped);
            setActiveTrackId(mapped[0].id);
        }
        setLoading(false);
    };
    fetchTracks();
  }, []);

  // 2. Poll for Rankings (Every 5 seconds)
  useEffect(() => {
    if (!activeTrackId) return;

    const fetchRankings = async () => {
        // Fetch raw data
        const { data: participants } = await supabase.from('participants').select('*').eq('competition_id', activeTrackId);
        const { data: scores } = await supabase.from('scores').select('*').eq('competition_id', activeTrackId);
        const { data: criteria } = await supabase.from('criteria').select('*').eq('competition_id', activeTrackId);
        
        if (!participants || !scores || !criteria) return;

        // Calculate Scores (Same logic as Admin Tabulation)
        const calculated = participants.map(team => {
            const teamScores = scores.filter(s => s.participant_id === team.participant_id);
            // Get unique judges who voted for this team
            const judgesVoted = new Set(teamScores.map(s => s.judge_id));
            let totalAverage = 0;

            judgesVoted.forEach(judgeId => {
                let judgeTotal = 0;
                criteria.forEach(c => {
                    const s = teamScores.find(ts => ts.judge_id === judgeId && ts.criteria_id === c.criteria_id);
                    if (s) judgeTotal += (s.score_value * c.weight_percentage) / 100;
                });
                totalAverage += judgeTotal;
            });

            const finalScore = judgesVoted.size > 0 ? totalAverage / judgesVoted.size : 0;

            return {
                id: team.participant_id,
                name: team.real_name,
                alias: team.alias || 'Team',
                score: parseFloat(finalScore.toFixed(2)),
                rank: 0
            };
        });

        // Sort and Assign Rank
        calculated.sort((a, b) => b.score - a.score);
        const ranked = calculated.map((item, index) => ({ ...item, rank: index + 1 }));

        setRankings(ranked);
    };

    fetchRankings();
    const interval = setInterval(fetchRankings, 5000); // Live Polling
    return () => clearInterval(interval);

  }, [activeTrackId]);

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading Expo Data...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      
      {/* Header / Track Switcher */}
      <div className="max-w-6xl mx-auto mb-10 text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">
            OFFICIAL LEADERBOARD
        </h1>
        
        {/* Track Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
            {tracks.map(track => (
                <button
                    key={track.id}
                    onClick={() => setActiveTrackId(track.id)}
                    className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                        activeTrackId === track.id 
                        ? 'bg-white text-slate-900 scale-105 shadow-lg shadow-white/20' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                    {track.title}
                </button>
            ))}
        </div>
      </div>

      {/* Leaderboard Cards */}
      <div className="max-w-4xl mx-auto space-y-4">
        {rankings.map((team, index) => {
            // Visual styles for Top 3
            const isGold = index === 0;
            const isSilver = index === 1;
            const isBronze = index === 2;
            
            let cardClass = "bg-slate-800 border-slate-700";
            let rankIcon = <span className="font-mono text-slate-500">#{team.rank}</span>;
            let scoreColor = "text-slate-400";

            if (isGold) {
                cardClass = "bg-gradient-to-r from-yellow-900/40 to-slate-900 border-yellow-500/50 shadow-yellow-900/20 shadow-lg scale-105 z-10 my-6";
                rankIcon = <Crown className="text-yellow-400 fill-yellow-400" size={32} />;
                scoreColor = "text-yellow-400";
            } else if (isSilver) {
                cardClass = "bg-slate-800 border-slate-400/50";
                rankIcon = <Medal className="text-slate-300" size={24} />;
                scoreColor = "text-slate-200";
            } else if (isBronze) {
                cardClass = "bg-slate-800 border-amber-700/50";
                rankIcon = <Medal className="text-amber-600" size={24} />;
                scoreColor = "text-amber-600";
            }

            return (
                <div key={team.id} className={`flex items-center p-6 rounded-2xl border transition-all ${cardClass}`}>
                    <div className="w-16 flex justify-center shrink-0">
                        {rankIcon}
                    </div>
                    <div className="flex-1 px-4">
                        <h2 className={`font-bold text-xl md:text-2xl ${isGold ? 'text-white' : 'text-slate-200'}`}>
                            {team.name}
                        </h2>
                        <p className="text-xs md:text-sm text-slate-500 uppercase tracking-widest font-bold">
                            {team.alias}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className={`text-3xl md:text-4xl font-black ${scoreColor}`}>
                            {team.score}
                        </div>
                        <div className="text-[10px] uppercase text-slate-600 font-bold">Total Score</div>
                    </div>
                </div>
            );
        })}

        {rankings.length === 0 && (
            <div className="text-center py-20 text-slate-600">
                <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                <p>Waiting for judges to submit scores...</p>
            </div>
        )}
      </div>

    </div>
  );
}