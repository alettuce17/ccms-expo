// DIRECTORY LOCATION: app/page.tsx
import Link from 'next/link';
import { ArrowRight, BarChart3, Smartphone } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
      
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-block px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-xs font-bold tracking-wider uppercase">
            Official Event System
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
            CCMS <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">EXPO</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-lg mx-auto leading-relaxed">
            Welcome to the College of Computing & Multimedia Studies Project Expo. 
            Real-time scoring, automated tabulation, and instant analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
          <Link 
            href="/scoreboard" 
            className="group flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/20 transition-all"
          >
            <BarChart3 className="mb-3 text-cyan-300" size={32} />
            <span className="font-bold text-lg">Public Scoreboard</span>
            <span className="text-xs text-slate-400 mt-1">View Live Rankings</span>
          </Link>

          <Link 
            href="/login" 
            className="group flex flex-col items-center justify-center p-6 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/50 hover:bg-blue-500 hover:scale-105 transition-all"
          >
            <Smartphone className="mb-3 text-white" size={32} />
            <div className="flex items-center gap-2 font-bold text-lg">
              Login <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-xs text-blue-200 mt-1">Judges & Admins</span>
          </Link>
        </div>
      </div>

      <div className="fixed bottom-6 text-xs text-slate-600 font-mono">
        System Status: <span className="text-green-500">● Online</span>
      </div>
    </div>
  );
}