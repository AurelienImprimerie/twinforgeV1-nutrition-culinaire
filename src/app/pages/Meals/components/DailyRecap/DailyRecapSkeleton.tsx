function DailyRecapSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* CTA Skeleton */}
      <div className="glass-card p-6 animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10"></div>
          <div className="h-8 w-64 bg-white/10 rounded-lg"></div>
          <div className="h-5 w-80 bg-white/10 rounded-lg"></div>
          <div className="h-14 w-full max-w-md bg-white/10 rounded-xl mt-4"></div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/10"></div>
              <div className="flex-1">
                <div className="h-4 w-24 bg-white/10 rounded mb-2"></div>
                <div className="h-3 w-32 bg-white/10 rounded"></div>
              </div>
            </div>
            <div className="h-8 w-16 bg-white/10 rounded"></div>
          </div>
        ))}
      </div>

      {/* Calorie Progress Skeleton */}
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4"></div>
        <div className="h-4 w-full bg-white/10 rounded mb-2"></div>
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-white/10 rounded"></div>
          <div className="h-3 w-16 bg-white/10 rounded"></div>
        </div>
      </div>

      {/* Macros Skeleton */}
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-4 w-20 bg-white/10 rounded"></div>
              <div className="h-8 w-16 bg-white/10 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DailyRecapSkeleton;
