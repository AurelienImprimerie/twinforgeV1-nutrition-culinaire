import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationEffectProps {
  show: boolean;
  performanceMode: string;
}

export default function CelebrationEffect({ show, performanceMode }: CelebrationEffectProps) {
  if (performanceMode !== 'premium') return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                background: ['#F7931E', '#FBBF24', '#F59E0B', '#FCD34D'][i % 4],
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: Math.cos((i * 2 * Math.PI) / 30) * (100 + Math.random() * 100),
                y: Math.sin((i * 2 * Math.PI) / 30) * (100 + Math.random() * 100),
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 1.5,
                ease: 'easeOut',
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
