import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  Search,
  TrendingUp,
  Coins,
  Plus,
  Gift,
  User,
  Rocket,
  Eye,
} from "lucide-react";

interface ProductTourProps {
  onComplete?: () => void;
}

// Animated Icon Component
function AnimatedIcon({
  icon: Icon,
  className = "",
}: {
  icon: any;
  className?: string;
}) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={className}
    >
      <Icon className="w-6 h-6 md:w-8 md:h-8" />
    </motion.div>
  );
}

// Compact Tour Content Component
function TourContent({
  icon: Icon,
  emoji,
  title,
  description,
}: {
  icon?: any;
  emoji?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-2 md:gap-3 items-start">
      <div className="flex-shrink-0 mt-0.5">
        {Icon ? (
          <AnimatedIcon icon={Icon} className="text-primary" />
        ) : emoji ? (
          <motion.span
            className="text-2xl md:text-3xl"
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {emoji}
          </motion.span>
        ) : null}
      </div>
      <div className="space-y-0.5 md:space-y-1 flex-1 min-w-0">
        <h3 className="text-sm md:text-base font-bold leading-tight">
          {title}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ProductTour({ onComplete }: ProductTourProps) {
  const [location] = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("hasSeenProductTour");
    if (!hasSeenTour && location === "/") {
      // Delay to ensure DOM elements are mounted
      setTimeout(() => setRun(true), 800);
    }
  }, [location]);

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div className="space-y-2 md:space-y-3">
          <div className="flex items-center gap-2">
            <motion.span
              className="text-2xl md:text-3xl"
              animate={{
                rotate: [0, 14, -8, 14, -4, 10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              👋
            </motion.span>
            <h2 className="text-lg md:text-xl font-bold">Welcome Every1!</h2>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground leading-snug">
            Let's take a quick tour of the key features, help you get started
            and make the most of the platform!
          </p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
    {
      target: ".top-creators-stories, [data-tour='top-creators']",
      content: (
        <TourContent
          emoji="⭐"
          title="Top Creators Stories"
          description="Discover top creators and their latest updates. Tap on a creator to view their profile, earnings and coins!"
        />
      ),
      placement: "bottom",
    },
    {
      target: "[data-testid='header-search']",
      content: (
        <TourContent
          icon={Search}
          title="Quick Search"
          description="Find creators, channel coins, and projects instantly. Just start typing to explore!"
        />
      ),
      placement: "bottom",
    },
    {
      target: "[data-tour='trending-coins']",
      content: (
        <TourContent
          icon={TrendingUp}
          title="Trending Coins"
          description="Click any coin to see details and start trading to support your favorite creators channels and content!"
        />
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "[data-testid='link-create']",
      content: (
        <TourContent
          icon={Plus}
          title="Create Your Coin"
          description="Turn your channel or content into a tradeable coin! Import from URL or upload your own media to get started."
        />
      ),
      placement: "bottom",
    },
    {
      target: "[data-testid='link-points']",
      content: (
        <TourContent
          icon={Gift}
          title="E1XP Rewards"
          description="Earn points for daily logins, trading, creating coins, and more! Redeem points for exclusive rewards."
        />
      ),
      placement: "bottom",
    },
    {
      target: "[data-testid='link-profile']",
      content: (
        <TourContent
          icon={User}
          title="Your Profile"
          description="Manage your profile, view your coins, track earnings, and showcase your achievements to the community!"
        />
      ),
      placement: "bottom",
    },
    {
      target: "[data-testid='button-login']",
      content: (
        <TourContent
          icon={Rocket}
          title="Ready to Start?"
          description="Login to unlock all features including creating coins, trading, earning E1XP points, and building your portfolio!"
        />
      ),
      placement: "bottom-end",
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      localStorage.setItem("hasSeenProductTour", "true");
      onComplete?.();
      return;
    }

    // Update step index when step changes
    if (type === "step:after") {
      // Move to next step on 'next' action, prev step on 'prev' action
      if (action === "next" && index < steps.length - 1) {
        setStepIndex(index + 1);
      } else if (action === "prev" && index > 0) {
        setStepIndex(index - 1);
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      scrollOffset={100}
      disableScrolling={false}
      disableOverlayClose
      spotlightClicks={false}
      callback={handleJoyrideCallback}
      floaterProps={{
        disableAnimation: false,
      }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          arrowColor: "hsl(var(--background))",
          overlayColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "16px",
          padding: "12px 16px",
          maxWidth: "320px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
        },
        tooltipContent: {
          padding: "0",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        spotlight: {
          borderRadius: "12px",
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        },
        overlay: {
          transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          color: "#000000",
          borderRadius: "8px",
          padding: "6px 16px",
          fontSize: "13px",
          fontWeight: "600",
          transition: "all 0.2s",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: "8px",
          fontSize: "13px",
          padding: "6px 12px",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
          fontSize: "13px",
          padding: "6px 12px",
        },
        buttonClose: {
          color: "hsl(var(--muted-foreground))",
          padding: "4px",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Let's Go!",
        next: "Next",
        skip: "Skip",
      }}
    />
  );
}
