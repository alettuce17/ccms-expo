'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { generateExpoExcel } from '@/lib/excel-generator';
import type { Participant, Judge, Score, Criteria, MatrixRow } from '@/types/expo';
import { Download, AlertTriangle, CheckCircle, RefreshCcw, Trash2, X, Lock, Unlock, Clock } from 'lucide-react';

export default function TabulationPage() {
  const supabase = createClient();
  const params = useParams();
  const competitionId = params.trackId;

  // Data State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedCell, setSelectedCell] = useState<{
    judge: Judge;
    participant: Participant;
    scoreTotal: number;
    hasRequest: boolean;
    isLocked: boolean;
    breakdown: { name: string; value: number }[];
  } | null>(null);

  // 1. Fetch Data
  const fetchData = async () => {
    if (!competitionId) return;
    if (participants.length === 0) setLoading(true);
    
    try {
      const { data: pData } = await supabase.from('participants').select('*').eq('competition_id', competitionId);
      const { data: jData } = await supabase.from('judges').select('*').eq('competition_id', competitionId).order('name');
      const { data: cData } = await supabase.from('criteria').select('*').eq('competition_id', competitionId);
      const { data: sData } = await supabase.from('scores').select('*').eq('competition_id', competitionId);

      if (pData) setParticipants(pData);
      if (jData) setJudges(jData);
      if (cData) setCriteria(cData);
      if (sData) setScores(sData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime Subscription
    const channel = supabase
      .channel('tabulation_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `competition_id=eq.${competitionId}` }, 
      () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [competitionId]);

  // 2. Calculation Engine
  useEffect(() => {
    if (loading || participants.length === 0) return;

    const calculatedMatrix: MatrixRow[] = participants.map((team) => {
      const teamScores = scores.filter((s) => s.participant_id === team.participant_id);
      const judgeTotals: Record<number, number> = {};
      const judgeRequests: Record<number, boolean> = {}; // Track requests
      const judgeRawValues: number[] = [];

      judges.forEach((judge) => {
        let currentJudgeTotal = 0;
        let criteriaCount = 0;
        let hasPendingRequest = false;

        criteria.forEach((crit) => {
          const scoreEntry = teamScores.find((s) => s.judge_id === judge.judge_id && s.criteria_id === crit.criteria_id);
          if (scoreEntry) {
            currentJudgeTotal += (scoreEntry.score_value * crit.weight_percentage) / 100;
            criteriaCount++;
            if (scoreEntry.unlock_request) hasPendingRequest = true;
          }
        });

        if (criteriaCount > 0) {
            const formattedTotal = parseFloat(currentJudgeTotal.toFixed(2));
            judgeTotals[judge.judge_id] = formattedTotal;
            judgeRequests[judge.judge_id] = hasPendingRequest;
            judgeRawValues.push(formattedTotal);
        }
      });

      const validJudgeCount = judgeRawValues.length;
      const sum = judgeRawValues.reduce((a, b) => a + b, 0);
      const finalAvg = validJudgeCount > 0 ? sum / validJudgeCount : 0;
      const maxScore = Math.max(...judgeRawValues, 0);
      const minScore = Math.min(...judgeRawValues, 0);
      const variance = validJudgeCount > 1 ? maxScore - minScore : 0;

      return {
        participant: team,
        judgeScores: judgeTotals,
        judgeRequests: judgeRequests,
        finalAverage: parseFloat(finalAvg.toFixed(2)),
        variance: parseFloat(variance.toFixed(2)),
      };
    });

    calculatedMatrix.sort((a, b) => b.finalAverage - a.finalAverage);
    setMatrix(calculatedMatrix);
  }, [participants, judges, scores, criteria, loading]);

  // 3. Handle Actions
  const handleUnlockScore = async () => {
    if (!selectedCell) return;
    
    // Unlock all criteria scores for this judge/participant
    const { error } = await supabase
        .from('scores')
        .update({ is_locked: false, unlock_request: false }) // <--- THE UNLOCK LOGIC
        .eq('judge_id', selectedCell.judge.judge_id)
        .eq('participant_id', selectedCell.participant.participant_id);

    if (error) alert('Error unlocking: ' + error.message);
    else {
        setSelectedCell(null);
        fetchData();
    }
  };

  const handleDeleteScore = async () => {
    if (!selectedCell) return;
    if (!confirm(`Permanently delete scores for ${selectedCell.participant.real_name}?`)) return;

    const { error } = await supabase
        .from('scores')
        .delete()
        .eq('judge_id', selectedCell.judge.judge_id)
        .eq('participant_id', selectedCell.participant.participant_id);

    if (error) alert('Error deleting: ' + error.message);
    else {
        setSelectedCell(null);
        fetchData();
    }
  };

  // 4. Handle Cell Click
  const handleCellClick = (judge: Judge, participant: Participant, totalScore: number) => {
     let requestActive = false;
     let lockedState = false;

     const breakdown = criteria.map(c => {
         const s = scores.find(s => s.judge_id === judge.judge_id && s.participant_id === participant.participant_id && s.criteria_id === c.criteria_id);
         if (s?.unlock_request) requestActive = true;
         if (s?.is_locked) lockedState = true;
         return { name: c.name, value: s ? s.score_value : 0 };
     });
     
     setSelectedCell({ 
         judge, 
         participant, 
         scoreTotal: totalScore, 
         breakdown, 
         hasRequest: requestActive,
         isLocked: lockedState
    });
  };

  const handleExport = () => {
    generateExpoExcel(matrix, judges, criteria, scores, "Competition_Results");
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Tabulation Data...</div>;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden relative">
      
      {/* HEADER */}
      <div className="flex-none p-6 bg-white border-b shadow-sm z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Live Tabulation</h1>
            <p className="text-slate-500 font-medium">Validation Matrix & Anomaly Detection <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full ml-2 animate-pulse">● LIVE</span></p>
          </div>
          <div className="flex gap-3">
              <button onClick={() => fetchData()} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 font-bold text-slate-700">
                  <RefreshCcw size={16} /> Refresh
              </button>
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 shadow-sm font-bold">
                  <Download size={16} /> Export Excel
              </button>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-max mx-auto border rounded-xl shadow-sm bg-white overflow-hidden relative">
          <table className="text-sm text-left text-slate-600 border-collapse">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-40 shadow-sm">
              <tr>
                <th className="px-4 py-4 sticky left-0 bg-slate-100 z-50 border-b w-[80px] text-center font-black border-r">Rank</th>
                <th className="px-6 py-4 sticky left-[80px] bg-slate-100 z-50 border-b shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[250px] font-black border-r">Team Name</th>
                {judges.map((j) => (
                  <th key={j.judge_id} className="px-4 py-3 text-center border-b border-r min-w-[140px] whitespace-nowrap bg-slate-100">
                    <div className="flex flex-col items-center" title={j.name}>
                        <span className="font-bold text-slate-800 max-w-[120px] truncate">{j.name}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-center border-b border-r bg-slate-200 min-w-[100px] font-bold">Variance</th>
                <th className="px-6 py-3 text-right bg-slate-900 text-white font-bold border-b min-w-[120px] sticky right-0 z-40">Final Score</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, index) => (
                <tr key={row.participant.participant_id} className="bg-white border-b hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-4 font-black text-center sticky left-0 bg-white z-30 border-r">#{index + 1}</td>
                  <td className="px-6 py-4 font-bold text-slate-900 sticky left-[80px] bg-white z-30 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)] border-r">
                      <div className="whitespace-nowrap">{row.participant.real_name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{row.participant.booth_code}</div>
                  </td>
                  {judges.map((j) => {
                    const score = row.judgeScores[j.judge_id];
                    const hasRequest = row.judgeRequests?.[j.judge_id];
                    
                    return (
                      <td 
                        key={j.judge_id} 
                        className={`px-4 py-4 text-center border-r border-slate-100 cursor-pointer transition-colors ${hasRequest ? 'bg-amber-100 hover:bg-amber-200' : 'hover:bg-slate-100'}`}
                        onClick={() => score && handleCellClick(j, row.participant, score)}
                      >
                        {score ? (
                          <div className="flex items-center justify-center gap-1">
                              {hasRequest && <Clock size={14} className="text-amber-600 animate-pulse" />}
                              <span className={`font-mono font-bold text-base ${hasRequest ? 'text-amber-800' : 'text-slate-800'}`}>
                                {score}
                              </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">...</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-center border-r bg-slate-50">
                      {row.variance > 15 ? (
                          <div className="flex items-center justify-center text-red-600 gap-1 font-bold"><AlertTriangle size={16} />{row.variance}</div>
                      ) : (
                          <div className="flex items-center justify-center text-green-600 gap-1 opacity-60 font-medium"><CheckCircle size={16} />{row.variance}</div>
                      )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-xl bg-slate-50 text-slate-900 sticky right-0 z-20 shadow-[-4px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.finalAverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACTION MODAL */}
      {selectedCell && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">Score Audit</h3>
                      <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      
                      {selectedCell.hasRequest && (
                          <div className="bg-amber-100 border border-amber-300 text-amber-900 p-3 rounded-lg flex items-start gap-2 text-sm font-medium">
                              <Clock size={18} className="shrink-0 mt-0.5" />
                              <p>Judge has requested permission to edit this score.</p>
                          </div>
                      )}

                      <div className="text-center">
                          <div className="text-xs font-bold text-slate-400 uppercase">Judge</div>
                          <div className="font-bold text-lg text-slate-900">{selectedCell.judge.name}</div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                          {selectedCell.breakdown.map((b, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{b.name}</span>
                                  <span className="font-bold text-slate-900">{b.value}</span>
                              </div>
                          ))}
                          <div className="border-t pt-2 flex justify-between font-black text-slate-900">
                              <span>Weighted Total</span>
                              <span>{selectedCell.scoreTotal}</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 pt-2">
                          {/* APPROVE BUTTON (Only if Locked or Requested) */}
                          {selectedCell.isLocked && (
                              <button 
                                onClick={handleUnlockScore}
                                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-md"
                              >
                                  <Unlock size={18} /> 
                                  {selectedCell.hasRequest ? "Approve Unlock Request" : "Unlock for Editing"}
                              </button>
                          )}

                          <button 
                            onClick={handleDeleteScore}
                            className="w-full bg-white text-red-600 py-3 rounded-xl font-bold border border-red-200 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                          >
                              <Trash2 size={18} /> Delete Score
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}