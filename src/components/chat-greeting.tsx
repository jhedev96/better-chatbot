"use client";

import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "auth/client";
import { useMemo, useState, useEffect } from "react";
import { FlipWords } from "ui/flip-words";
import { HoverWords } from "ui/hover-words";
import { Mascot } from "ui/mascot";
import { useTranslations } from "next-intl";

// Helper function to get greeting based on time of day
function getGreetingByTime() {
  const date = new Date();
  const hour = date.getHours() + (date.getMinutes() * .01);
  if (hour >= 5 && hour < 9) return "goodMorning";
  if (hour >= 9 && hour < 16) return "haveANiceDay";
  if (hour >= 16 && hour < 18) return "goodAfternoon";
  if (hour >= 18 && hour < 21) return "goodEvening";
  if (hour >= 21 && hour < 24) return "goodNight";
  if (hour >= 0 && hour < 5) return "haveANiceDream";
  return "haveANiceDay"; // Default fallback
}

export const ChatGreeting = () => {
  const { data: session } = authClient.useSession();
  const t = useTranslations("Chat.Greeting");
  const user = session?.user;
  const [isFlipAnimationDone, setIsFlipAnimationDone] = useState(false);
  const ANIMATION_SWITCH_DELAY = 3500;

  const word = useMemo(() => {
    if (!user?.name) return "";
    const words = [
      t(getGreetingByTime(), { name: user.name }),
      t("niceToSeeYouAgain", { name: user.name }),
      t("whatAreYouWorkingOnToday", { name: user.name }),
      t("letMeKnowWhenYoureReadyToBegin"),
      t("whatAreYourThoughtsToday"),
      t("whereWouldYouLikeToStart"),
      t("whatAreYouThinking", { name: user.name }),
    ];
    return words[Math.floor(Math.random() * words.length)];
  }, [user?.name, t]);

  useEffect(() => {
    if (word) {
      const timer = setTimeout(() => {
        setIsFlipAnimationDone(true);
      }, ANIMATION_SWITCH_DELAY);
      return () => clearTimeout(timer);
    }
  }, [word]);

  if (!word) {
    return <div className="max-w-3xl mx-auto my-4 h-20" />;
  }

  return (
    // WRAPPER: Pembungkus utama untuk menengahkan semua konten secara vertikal
    <div className="flex flex-col items-center justify-center gap-4">
        {/* PERUBAHAN 1: Atur ukuran Mascot dengan nilai tetap. */}
        {/* Anda bisa mengubah w-40 h-40 menjadi ukuran lain seperti w-32 h-32 atau w-48 h-48 */}
        <AnimatePresence>
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                <Mascot
                    srcFiles="/mascot/Robot.json"
                    className="w-40 h-40" // Menggunakan ukuran tetap (10rem atau 160px)
                />
            </motion.div>
        </AnimatePresence>
        {/* PERUBAHAN 2: Div sapaan sekarang menjadi bagian dari flex container */}
        <motion.div
            key="welcome"
            className="max-w-3xl mx-auto h-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3 }}
        >
            <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
                <AnimatePresence mode="wait">
                    {!isFlipAnimationDone ? (
                    <h1 key="flip-words" className="text-2xl md:text-3xl">
                        {word ? <FlipWords words={[word]} className="text-primary" /> : ""}
                    </h1>
                    ) : (
                    <motion.div
                        key="hover-words"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 className="text-2xl md:text-3xl">
                            <HoverWords
                                text={word}
                                minWeight={200}
                                maxWeight={900}
                                className="text-primary"
                            />
                        </h1>
                    </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    </div>
  );
};

