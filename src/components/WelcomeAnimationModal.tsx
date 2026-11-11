import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Store,
  Barcode,
  CloudCheck,
  Volume2,
  VolumeX,
  Boxes,
  Zap,
} from 'lucide-react';
import { AppUser, StoreConfig } from '../types/pos.ts';
import { soundEffects } from '../utils/soundEffects.ts';
import sappySquareIcon from '../assets/images/sappy_icon_square_1793958931489.jpg';

interface WelcomeAnimationModalProps {
  user: AppUser;
  config: StoreConfig;
  onComplete: () => void;
  isFirstLogin?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  color: string;
}

export const WelcomeAnimationModal: React.FC<WelcomeAnimationModalProps> = ({
  user,
  config,
  onComplete,
  isFirstLogin = true,
}) => {
  const [stage, setStage] = useState<number>(0); // 0: Logo emerge, 1: Greeting, 2: Checks, 3: Ready
  const [progress, setProgress] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(soundEffects.getIsMuted());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Play fanfare on mount
  useEffect(() => {
    try {
      soundEffects.playWelcomeFanfare();
    } catch {}
  }, []);

  // Staged revelation sequence
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 500);  // Greeting reveal
    const t2 = setTimeout(() => setStage(2), 1200); // System checks reveal
    const t3 = setTimeout(() => setStage(3), 2000); // CTA & ready reveal

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Auto-advance progress bar (5.5 seconds)
  useEffect(() => {
    const totalDuration = 5500;
    const intervalTime = 40;
    const increment = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          onComplete();
          return 100;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  // Keyboard shortcut listener (Enter or Escape to immediately enter terminal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        soundEffects.playClick();
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  // Golden and Emerald floating ambient particles canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#f59e0b', '#fbbf24', '#10b981', '#34d399', '#d97706'];
    const particleCount = 45;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.5 + 1,
        speedY: -(Math.random() * 0.7 + 0.3),
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.6 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleToggleMute = () => {
    const next = soundEffects.toggleMute();
    setIsMuted(next);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Store Owner · Commercial Administrator';
      case 'manager':
        return 'Store Manager · Supervisor & Inventory Control';
      case 'cashier':
      default:
        return 'Store Cashier · POS Terminal & Sales Desk';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/92 backdrop-blur-xl overflow-hidden select-none animate-in fade-in duration-300">
      
      {/* Background Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0"
      />

      {/* Ambient Radial Glow Overlays */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-forest-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Central Welcome Card */}
      <div className="relative z-10 max-w-lg w-full bg-charcoal-900/90 border border-charcoal-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md overflow-hidden text-center text-white">
        
        {/* Top Sound and Skip Controls */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className="p-2 rounded-xl text-charcoal-400 hover:text-white bg-charcoal-950/60 hover:bg-charcoal-800 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            type="button"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-charcoal-500" /> : <Volume2 className="w-4 h-4 text-forest-400" />}
          </button>
        </div>

        {/* Phase 0: Golden Sappy Crest */}
        <div className="flex flex-col items-center justify-center mb-5">
          <div className="relative group">
            {/* Glowing Aura Ring */}
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/30 via-forest-500/40 to-amber-500/30 rounded-2xl blur-md opacity-80 animate-pulse pointer-events-none" />
            
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-500/70 shadow-xl bg-charcoal-950 flex items-center justify-center transition-transform duration-500 scale-100 hover:scale-105">
              <img
                src={sappySquareIcon}
                alt="Sappy Stationery"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="mt-3.5 space-y-0.5">
            <span className="font-serif tracking-widest text-xs uppercase font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400">
              {config.storeName || 'SAPPY STATIONARY'}
            </span>
            <p className="text-[11px] text-charcoal-400 font-mono tracking-tight">
              Retail Point of Sale & Inventory Operating System
            </p>
          </div>
        </div>

        {/* Phase 1: Personal Welcome Greeting */}
        <div
          className={`space-y-1.5 transition-all duration-700 ${
            stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isFirstLogin ? 'First Terminal Sign-In' : 'Welcome Back'}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Welcome, <span className="text-forest-300 font-extrabold">{user.fullName}</span>
          </h1>

          <p className="text-xs text-charcoal-300 font-medium">
            {getRoleBadge(user.role)}
          </p>
        </div>

        {/* Phase 2: Live System Readiness Audit */}
        <div
          className={`my-5 transition-all duration-700 ${
            stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="bg-charcoal-950/70 rounded-2xl p-3.5 sm:p-4 border border-charcoal-800/80 space-y-2.5 text-left text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-charcoal-800/60">
              <span className="text-[11px] font-semibold uppercase font-mono tracking-wider text-charcoal-400">
                System Status Checklist
              </span>
              <span className="text-[10px] font-mono text-forest-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-ping inline-block" />
                Terminal Ready
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-charcoal-200">
              <div className="w-5 h-5 rounded-md bg-forest-950/80 border border-forest-700/80 flex items-center justify-center text-forest-400 shrink-0">
                <Boxes className="w-3 h-3" />
              </div>
              <div className="flex-1 truncate">
                <span className="font-semibold text-white">Stationery Inventory & Barcodes</span>
                <span className="block text-[10px] text-charcoal-400 font-mono">16 Starter Catalog Items & Low-Stock Alerts</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-forest-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2.5 text-charcoal-200">
              <div className="w-5 h-5 rounded-md bg-forest-950/80 border border-forest-700/80 flex items-center justify-center text-forest-400 shrink-0">
                <Barcode className="w-3 h-3" />
              </div>
              <div className="flex-1 truncate">
                <span className="font-semibold text-white">Hardware & Optical Scanner Ready</span>
                <span className="block text-[10px] text-charcoal-400 font-mono">USB/Bluetooth HID & Integrated Camera Online</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-forest-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2.5 text-charcoal-200">
              <div className="w-5 h-5 rounded-md bg-forest-950/80 border border-forest-700/80 flex items-center justify-center text-forest-400 shrink-0">
                <Zap className="w-3 h-3" />
              </div>
              <div className="flex-1 truncate">
                <span className="font-semibold text-white">Cloud Database & Offline Cache</span>
                <span className="block text-[10px] text-charcoal-400 font-mono">Supabase Sync Engine & Local Storage Active</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-forest-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* Phase 3: Action Button & Countdown Bar */}
        <div
          className={`space-y-3 transition-all duration-700 ${
            stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={() => {
              soundEffects.playClick();
              onComplete();
            }}
            className="w-full py-3 px-5 bg-gradient-to-r from-forest-700 to-forest-600 hover:from-forest-600 hover:to-forest-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer border border-forest-500/40"
            type="button"
          >
            <span>Enter POS Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Progress Bar Auto Advance */}
          <div className="space-y-1">
            <div className="w-full bg-charcoal-950 h-1.5 rounded-full overflow-hidden border border-charcoal-800">
              <div
                className="bg-gradient-to-r from-amber-400 via-forest-400 to-forest-500 h-full transition-all duration-100 ease-linear rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-charcoal-500 font-mono">
              Press <kbd className="px-1 py-0.5 rounded bg-charcoal-800 text-charcoal-300 border border-charcoal-700 text-[9px]">Enter</kbd> or click to launch instantly
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
