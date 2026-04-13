"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface LuckyCard {
  id: number;
  type: "a" | "b" | "c";
  flipped: boolean;
  flipped_by_team_id?: string;
  question_index?: number;
}

export interface LuckyCardTeam {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface LuckyCardQuestion {
  question_text: string;
  question_type?: string;
  options?: string[];
  correct_index?: number;
}

interface LuckyCardBoardProps {
  board: LuckyCard[];
  currentTeam: LuckyCardTeam | null;
  teams: LuckyCardTeam[];
  myTeamId?: string;
  canSelect: boolean;           // true if this user can select a card
  pendingQuestion?: LuckyCardQuestion | null;
  pendingCardId?: number | null;
  emotion?: "correct" | "wrong" | "lucky" | "unlucky" | null;
  sessionXp?: number;
  onSelectCard?: (cardId: number) => void;
  onSubmitAnswer?: (answer: unknown) => void;
}

const CARD_COLORS = {
  a: { face: "bg-red-500", border: "border-red-600", label: "📝 Test", points: "+10" },
  b: { face: "bg-yellow-400", border: "border-yellow-500", label: "⭐ Omadli", points: "+12" },
  c: { face: "bg-gray-400", border: "border-gray-500", label: "💀 Omadsiz", points: "0" },
};

const EMOTION_CONFIG = {
  correct: { emoji: "🎉", text: "To'g'ri! +10 ball", bg: "bg-green-500", sound: null },
  wrong: { emoji: "😢", text: "Noto'g'ri! 0 ball", bg: "bg-red-500", sound: null },
  lucky: { emoji: "🌟", text: "Omadli karta! +12 ball", bg: "bg-yellow-400", sound: null },
  unlucky: { emoji: "😞", text: "Omadsiz karta! 0 ball", bg: "bg-gray-500", sound: null },
};

function playSound(type: "correct" | "wrong" | "lucky" | "unlucky") {
  // Use Web Audio API for simple tones
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "correct" || type === "lucky") {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // AudioContext not available
  }
}

export default function LuckyCardBoard({
  board,
  currentTeam,
  teams,
  myTeamId,
  canSelect,
  pendingQuestion,
  pendingCardId,
  emotion,
  sessionXp = 0,
  onSelectCard,
  onSubmitAnswer,
}: LuckyCardBoardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showEmotion, setShowEmotion] = useState(false);

  useEffect(() => {
    if (emotion) {
      setShowEmotion(true);
      playSound(emotion);
      const t = setTimeout(() => setShowEmotion(false), 2000);
      return () => clearTimeout(t);
    }
  }, [emotion]);

  const isMyTurn = currentTeam?.id === myTeamId;
  const closedCount = board.filter((c) => !c.flipped).length;
  const totalCount = board.length;

  return (
    <div className="space-y-4 select-none">
      {/* Scoreboard */}
      <div className="flex gap-2 flex-wrap justify-center">
        {teams.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-medium transition-all ${
              currentTeam?.id === t.id ? "ring-2 ring-white scale-105" : "opacity-80"
            }`}
            style={{ backgroundColor: t.color }}
          >
            <span>{t.name}</span>
            <Badge variant="secondary" className="text-xs">{t.score} ball</Badge>
          </div>
        ))}
      </div>

      {/* Turn indicator */}
      {currentTeam && (
        <div className="text-center">
          <motion.div
            key={currentTeam.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-semibold"
            style={{ backgroundColor: currentTeam.color }}
          >
            {isMyTurn ? "🎯 Sizning navbatingiz!" : `🕐 ${currentTeam.name} jamoasi navbati`}
          </motion.div>
        </div>
      )}

      {/* Progress */}
      <div className="text-center text-xs text-muted-foreground">
        {closedCount} ta karta qoldi / {totalCount} ta jami
      </div>

      {/* Card grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(totalCount)), 6)}, 1fr)` }}>
        {board.map((card) => {
          const isPending = card.id === pendingCardId;
          const colorConfig = card.flipped ? CARD_COLORS[card.type] : null;

          return (
            <motion.div
              key={card.id}
              whileHover={!card.flipped && canSelect && isMyTurn ? { scale: 1.08 } : {}}
              whileTap={!card.flipped && canSelect && isMyTurn ? { scale: 0.95 } : {}}
              className={`aspect-square rounded-xl border-2 flex items-center justify-center text-center p-2 transition-all cursor-${
                !card.flipped && canSelect && isMyTurn ? "pointer" : "default"
              } ${
                card.flipped
                  ? `${colorConfig!.face} ${colorConfig!.border} text-white`
                  : "bg-blue-600 border-blue-700 text-white hover:bg-blue-500"
              } ${isPending ? "ring-2 ring-yellow-400 ring-offset-2" : ""}`}
              onClick={() => {
                if (!card.flipped && canSelect && isMyTurn && onSelectCard) {
                  onSelectCard(card.id);
                }
              }}
            >
              {card.flipped ? (
                <motion.div
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <div className="text-lg">{colorConfig!.label.split(" ")[0]}</div>
                  <div className="text-xs font-bold mt-1">{colorConfig!.points}</div>
                </motion.div>
              ) : (
                <div className="text-2xl font-bold">?</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Question panel (type A card) */}
      <AnimatePresence>
        {pendingQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="border-2 border-primary rounded-xl p-4 space-y-3"
          >
            <p className="text-sm font-medium text-center">{pendingQuestion.question_text}</p>
            {pendingQuestion.options && (
              <div className="grid grid-cols-2 gap-2">
                {pendingQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`p-3 rounded-lg border-2 text-sm text-left transition-colors ${
                      selectedOption === i
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-muted hover:border-primary/50"
                    }`}
                    onClick={() => canSelect && isMyTurn && setSelectedOption(i)}
                  >
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + i)})</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {canSelect && isMyTurn && (
              <Button
                className="w-full"
                disabled={selectedOption === null}
                onClick={() => {
                  if (selectedOption !== null && onSubmitAnswer) {
                    onSubmitAnswer(selectedOption);
                    setSelectedOption(null);
                  }
                }}
              >
                Javobni yuborish
              </Button>
            )}
            {!isMyTurn && (
              <p className="text-xs text-center text-muted-foreground">
                {currentTeam?.name} jamoasi javob bermoqda...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emotion overlay */}
      <AnimatePresence>
        {showEmotion && emotion && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className={`${EMOTION_CONFIG[emotion].bg} rounded-2xl px-10 py-8 text-white text-center shadow-2xl`}>
              <div className="text-6xl mb-3">{EMOTION_CONFIG[emotion].emoji}</div>
              <div className="text-xl font-bold">{EMOTION_CONFIG[emotion].text}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session XP indicator */}
      {sessionXp > 0 && (
        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            Bu sessiyada {sessionXp} XP to&apos;pladingiz — dars tugagach qo&apos;shiladi
          </span>
        </div>
      )}
    </div>
  );
}
