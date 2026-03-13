import { motion } from "framer-motion";

export function SplashScreen() {
  const blobs = [
    {
      color: "bg-gradient-to-br from-pink-400 to-pink-500",
      size: "w-20 h-20",
      top: "10%",
      left: "15%",
      delay: 0,
    },
    {
      color: "bg-gradient-to-br from-green-400 to-emerald-500",
      size: "w-24 h-24",
      top: "15%",
      right: "20%",
      delay: 0.1,
    },
    {
      color: "bg-gradient-to-br from-blue-400 to-cyan-500",
      size: "w-16 h-16",
      top: "25%",
      left: "10%",
      delay: 0.2,
    },
    {
      color: "bg-gradient-to-br from-orange-400 to-orange-500",
      size: "w-20 h-20",
      bottom: "30%",
      left: "18%",
      delay: 0.15,
    },
    {
      color: "bg-gradient-to-br from-yellow-400 to-yellow-500",
      size: "w-28 h-28",
      bottom: "20%",
      right: "15%",
      delay: 0.25,
    },
    {
      color: "bg-gradient-to-br from-purple-400 to-purple-500",
      size: "w-16 h-16",
      bottom: "35%",
      right: "25%",
      delay: 0.05,
    },
    {
      color: "bg-gradient-to-br from-teal-400 to-teal-500",
      size: "w-20 h-20",
      top: "40%",
      left: "8%",
      delay: 0.2,
    },
    {
      color: "bg-gradient-to-br from-rose-400 to-rose-500",
      size: "w-18 h-18",
      bottom: "15%",
      left: "12%",
      delay: 0.3,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden"
    >
      {/* Animated Blobs */}
      {blobs.map((blob, index) => (
        <motion.div
          key={index}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.1, 1],
            opacity: [0, 1, 1],
            y: [0, -10, 0],
          }}
          transition={{
            duration: 1.5,
            delay: blob.delay,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
          className={`absolute ${blob.size} ${blob.color} rounded-full shadow-lg`}
          style={{
            top: blob.top,
            left: blob.left,
            right: blob.right,
            bottom: blob.bottom,
          }}
        >
          {/* Cute face */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="flex gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-black/70 rounded-full" />
              <div className="w-1.5 h-1.5 bg-black/70 rounded-full" />
            </div>
            <div className="absolute bottom-1/3 w-2 h-1 bg-pink-300/50 rounded-full" />
          </div>
        </motion.div>
      ))}

      {/* App Name */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="relative z-10"
      >
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
          Every1.fun
        </h1>
      </motion.div>

      {/* Loading indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-20 flex gap-2"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            className="w-2 h-2 bg-gray-900 dark:bg-white rounded-full"
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
