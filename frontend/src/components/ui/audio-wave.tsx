'use client'

import { PhoneOutgoing } from 'lucide-react'

const AudioWave = () => {
  return (
    <div className="flex items-center gap-2 my-4">
      <style jsx>{`
        @keyframes audioWave {
          0%, 100% {
            transform: scaleY(0.2);
          }
          50% {
            transform: scaleY(${0.3 + Math.random() * 0.7});
          }
        }
      `}</style>
      <PhoneOutgoing fill="green" className="h-10 w-10 text-green-700" />
      <div className="flex items-center gap-[2px] h-10">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="w-[3px] bg-green-700 rounded-full opacity-80"
            style={{
              height: '100%',
              animationName: 'audioWave',
              animationDuration: `${0.7 + Math.random() * 0.7}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDelay: `${i * 0.02}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export { AudioWave }