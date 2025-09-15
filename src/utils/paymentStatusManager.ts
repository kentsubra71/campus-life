import { Timestamp } from 'firebase/firestore';

export type PaymentStatus =
  | 'initiated'           // Payment created, neither confirmed
  | 'confirmed_by_parent' // Parent sent payment, awaiting student confirmation
  | 'confirmed'           // Both parent and student confirmed (final state)
  | 'disputed'            // Student reported issue
  | 'cancelled'           // Parent cancelled before sending
  | 'failed'              // System failure
  | 'completed';          // Legacy status alias for 'confirmed'

export interface PaymentData {
  id?: string;
  status: PaymentStatus;
  amount_cents?: number;
  confirmed_at?: Timestamp;
  parent_sent_at?: Timestamp;
  student_confirmed_at?: Timestamp;
  student_amount_received?: number;
  cancelled_at?: Timestamp;
  disputed_at?: Timestamp;
  updated_at: Timestamp;
}

export class PaymentStatusManager {

  /**
   * Validate if a status transition is allowed
   */
  static isValidTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
    const transitions: Record<PaymentStatus, PaymentStatus[]> = {
      'initiated': ['confirmed_by_parent', 'confirmed', 'cancelled', 'failed'],
      'confirmed_by_parent': ['confirmed', 'disputed', 'failed'],
      'confirmed': [], // Final state - no transitions allowed
      'disputed': ['confirmed', 'failed'], // Can be resolved
      'cancelled': [], // Final state
      'failed': ['initiated'], // Can retry
      'completed': [] // Legacy final state
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Determine the final status when both parent and student actions are present
   */
  static resolveFinalStatus(
    currentStatus: PaymentStatus,
    hasParentConfirmation: boolean,
    hasStudentConfirmation: boolean
  ): PaymentStatus {
    // If both confirmed, payment is complete
    if (hasParentConfirmation && hasStudentConfirmation) {
      return 'confirmed';
    }

    // If only parent confirmed
    if (hasParentConfirmation && !hasStudentConfirmation) {
      return 'confirmed_by_parent';
    }

    // If only student confirmed (rare case, but handle it)
    if (!hasParentConfirmation && hasStudentConfirmation) {
      return currentStatus === 'initiated' ? 'confirmed' : currentStatus;
    }

    // Neither confirmed yet
    return 'initiated';
  }

  /**
   * Check if an action is allowed given current payment state
   */
  static canParentConfirm(currentStatus: PaymentStatus): boolean {
    return ['initiated', 'confirmed_by_parent'].includes(currentStatus);
  }

  static canStudentConfirm(currentStatus: PaymentStatus): boolean {
    return ['initiated', 'confirmed_by_parent', 'confirmed'].includes(currentStatus);
  }

  static canDispute(currentStatus: PaymentStatus): boolean {
    return ['confirmed_by_parent', 'initiated'].includes(currentStatus);
  }

  static canCancel(currentStatus: PaymentStatus): boolean {
    return ['initiated'].includes(currentStatus);
  }

  /**
   * Get human-readable status description
   */
  static getStatusDescription(status: PaymentStatus): string {
    switch (status) {
      case 'initiated': return 'Processing';
      case 'confirmed_by_parent': return 'Sent by Parent';
      case 'confirmed': return 'Completed';
      case 'completed': return 'Completed'; // Legacy
      case 'disputed': return 'Disputed';
      case 'cancelled': return 'Cancelled';
      case 'failed': return 'Failed';
      default: return status;
    }
  }

  /**
   * Get status color for UI
   */
  static getStatusColor(status: PaymentStatus): string {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return '#10b981'; // Green
      case 'confirmed_by_parent':
        return '#f59e0b'; // Orange - awaiting student confirmation
      case 'initiated':
        return '#3b82f6'; // Blue - processing
      case 'disputed':
      case 'failed':
        return '#dc2626'; // Red
      case 'cancelled':
        return '#6b7280'; // Gray
      default:
        return '#6b7280';
    }
  }

  /**
   * Check if payment is in a final state (no more changes allowed)
   */
  static isFinalState(status: PaymentStatus): boolean {
    return ['confirmed', 'completed', 'cancelled', 'disputed'].includes(status);
  }

  /**
   * Build atomic update data for parent confirmation
   */
  static buildParentConfirmationUpdate(currentData: PaymentData): Partial<PaymentData> {
    const hasStudentConfirmation = !!currentData.student_confirmed_at;
    const finalStatus = this.resolveFinalStatus(
      currentData.status,
      true, // Parent is confirming
      hasStudentConfirmation
    );

    return {
      status: finalStatus,
      confirmed_at: Timestamp.now(),
      parent_sent_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
  }

  /**
   * Build atomic update data for student confirmation
   */
  static buildStudentConfirmationUpdate(
    currentData: PaymentData,
    receivedCents: number
  ): Partial<PaymentData> {
    const hasParentConfirmation = !!currentData.confirmed_at || !!currentData.parent_sent_at;
    const finalStatus = this.resolveFinalStatus(
      currentData.status,
      hasParentConfirmation,
      true // Student is confirming
    );

    return {
      status: finalStatus,
      student_confirmed_at: Timestamp.now(),
      student_amount_received: receivedCents,
      updated_at: Timestamp.now()
    } as any;
  }
}