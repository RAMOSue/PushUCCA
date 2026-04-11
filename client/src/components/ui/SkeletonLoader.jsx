/**
 * SkeletonLoader Component
 * Provides smooth, accessible loading placeholders
 */

export function SkeletonLoading({ className = "" }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-lg ${className}`}
      aria-busy="true"
      aria-label="Loading..."
    />
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 transition-colors">
      {/* Avatar Skeleton */}
      <div className="flex flex-col items-center mb-6">
        <SkeletonLoading className="w-32 h-32 rounded-full mb-4" />
        <SkeletonLoading className="h-6 w-40 mb-2" />
        <SkeletonLoading className="h-4 w-32" />
      </div>
    </div>
  );
}

export function FormSectionSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonLoading className="h-4 w-24 mb-4" />
      <SkeletonLoading className="h-10 w-full mb-3" />
      <SkeletonLoading className="h-10 w-full" />
    </div>
  );
}

export function ProfileWorkspaceSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel */}
      <div className="lg:col-span-1">
        <ProfileCardSkeleton />
      </div>

      {/* Right Panel */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
          <FormSectionSkeleton />
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
          <FormSectionSkeleton />
        </div>
      </div>
    </div>
  );
}
