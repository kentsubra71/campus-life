import { cleanupTimedOutPayments, PAYMENT_TIMEOUT_CONFIG } from '../utils/paymentTimeout';

/**
 * Payment Cleanup Background Service
 * Runs periodically to clean up timed-out payments
 */
class PaymentCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastCleanup: Date | null = null;
  private cleanupHistory: Array<{
    timestamp: Date;
    cleaned: number;
    errors: number;
  }> = [];

  /**
   * Start the cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Payment cleanup service already running');
      return;
    }

    console.log('🚀 Starting payment cleanup service...');
    this.isRunning = true;

    // Run initial cleanup
    this.runCleanup();

    // Schedule periodic cleanup
    const intervalMs = PAYMENT_TIMEOUT_CONFIG.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, intervalMs);

    console.log(`⏰ Payment cleanup scheduled every ${PAYMENT_TIMEOUT_CONFIG.CLEANUP_INTERVAL_HOURS} hours`);
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping payment cleanup service...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * Run cleanup manually
   */
  async runCleanup(): Promise<void> {
    try {
      const startTime = new Date();
      console.log(`🧹 Running payment timeout cleanup at ${startTime.toISOString()}`);

      const results = await cleanupTimedOutPayments();
      
      this.lastCleanup = startTime;
      this.cleanupHistory.push({
        timestamp: startTime,
        cleaned: results.cleaned,
        errors: results.errors
      });

      // Keep only last 50 cleanup records
      if (this.cleanupHistory.length > 50) {
        this.cleanupHistory = this.cleanupHistory.slice(-50);
      }

      // Log summary
      if (results.cleaned > 0 || results.errors > 0) {
        console.log(`✅ Cleanup completed: ${results.cleaned} payments timed out, ${results.errors} errors`);
        
        if (results.details.length > 0) {
          console.log('📋 Cleanup details:', results.details);
        }
      } else {
        console.log('✨ No timed-out payments found');
      }

    } catch (error) {
      console.error('❌ Payment cleanup service error:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup,
      nextCleanup: this.isRunning && this.lastCleanup ? 
        new Date(this.lastCleanup.getTime() + (PAYMENT_TIMEOUT_CONFIG.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000)) : 
        null,
      totalCleanups: this.cleanupHistory.length,
      recentHistory: this.cleanupHistory.slice(-10) // Last 10 cleanups
    };
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    const stats = {
      totalRuns: this.cleanupHistory.length,
      totalCleaned: this.cleanupHistory.reduce((sum, run) => sum + run.cleaned, 0),
      totalErrors: this.cleanupHistory.reduce((sum, run) => sum + run.errors, 0),
      averageCleaned: 0,
      lastWeekRuns: 0,
      lastWeekCleaned: 0
    };

    if (stats.totalRuns > 0) {
      stats.averageCleaned = Math.round((stats.totalCleaned / stats.totalRuns) * 100) / 100;
    }

    // Calculate last week stats
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastWeekHistory = this.cleanupHistory.filter(run => run.timestamp > lastWeek);
    stats.lastWeekRuns = lastWeekHistory.length;
    stats.lastWeekCleaned = lastWeekHistory.reduce((sum, run) => sum + run.cleaned, 0);

    return stats;
  }
}

// Create singleton instance
export const paymentCleanupService = new PaymentCleanupService();

// Auto-start service when module is loaded (for production)
// Comment out for development/testing
if (process.env.NODE_ENV === 'production') {
  paymentCleanupService.start();
}

export default paymentCleanupService;