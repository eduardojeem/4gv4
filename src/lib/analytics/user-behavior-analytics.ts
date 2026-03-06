export interface UserBehaviorMetrics {
  totalSessions: number
  pageViewsPerSession: number
  uniqueUsers: number
  bounceRate: number
}

const DEFAULT_BEHAVIOR_METRICS: UserBehaviorMetrics = {
  totalSessions: 0,
  pageViewsPerSession: 0,
  uniqueUsers: 0,
  bounceRate: 0,
}

export const userBehaviorAnalytics = {
  async getBehaviorMetrics(
    _startDate: Date,
    _endDate: Date
  ): Promise<UserBehaviorMetrics> {
    return DEFAULT_BEHAVIOR_METRICS
  },
}

