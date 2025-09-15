# Campus Life

A React Native application for secure family financial support and wellness tracking designed for college students and their parents.

## 🚀 Current Status: Production Ready

**Latest Update:** September 2025 - Complete application with enhanced UX
- ✅ **Registration System**: Seamless loading screens and error handling
- ✅ **Payment Processing**: PayPal.Me integration with real-time updates
- ✅ **User Experience**: Pull-to-refresh, auto-reload, and smooth navigation
- ✅ **Security Architecture**: Firebase Auth cleanup and proper error handling
- ✅ **Code Quality**: Project cleaned and optimized for production

## Product Overview

Campus Life facilitates direct peer-to-peer financial transfers between parents and students while maintaining comprehensive wellness tracking and family communication. The platform enables parents to send immediate financial support through PayPal integration and monitor student wellbeing through structured data collection.

### Core Functionality

**Direct Payment System**
- Real-time PayPal peer-to-peer payments with immediate processing
- Monthly budget enforcement with automatic spending cap management
- Comprehensive transaction history with detailed audit trails
- Automatic payment verification with Firebase Cloud Functions integration

**Wellness Data Platform**
- Seven-metric wellness logging system (mood, sleep, exercise, nutrition, water intake, social interaction, academic performance)
- Historical data visualization with trend analysis
- Family dashboard access to student wellness patterns
- Automated data synchronization with offline capability

**Family Communication Network**
- Real-time messaging system with push notification delivery
- Emergency support request functionality with immediate family alerts
- Activity monitoring and family interaction logging
- Secure family linking with role-based access control

## Technical Architecture

### Frontend Implementation
- **React Native 0.74** with Expo SDK 51 for cross-platform deployment
- **TypeScript 5.3** with strict type checking and interface definitions
- **React Navigation 6** with stack and bottom tab navigation patterns
- **Zustand 4.4** for state management with persistence and hydration
- **Firebase SDK 10.x** for authentication, database, and cloud functions

### Backend Infrastructure
- **Firebase Authentication** with email verification and family account linking
- **Cloud Firestore** with real-time synchronization and offline persistence
- **Firebase Cloud Functions** (Node.js 18) with firebase-functions v6.4.0
- **Firebase Admin SDK** v13.5.0 with enhanced security validation
- **Firebase Security Rules** with registration-safe permissions and family isolation
- **Google Secret Manager** for secure API key management
- **Expo Push Notifications** with Apple/Google FCM integration

### Payment Processing Architecture
- **PayPal Orders API v2** for direct peer-to-peer transaction processing
- **Firebase Cloud Functions** middleware for payment verification and capture
- **Idempotency key system** to prevent duplicate payment processing
- **Real-time status updates** with automatic retry mechanisms

### Data Schema Design

**User Management System**
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'student';
  familyId: string;
  paypal_me_handle?: string;
  createdAt: Date;
}

interface Family {
  id: string;
  name: string;
  parentIds: string[];
  studentIds: string[];
  created_at: Timestamp;
}
```

**Financial Transaction System**
```typescript
interface Payment {
  id: string;
  parent_id: string;
  student_id: string;
  intent_cents: number;
  status: 'initiated' | 'completed' | 'failed' | 'cancelled';
  provider: 'paypal';
  paypal_order_id: string;
  paypal_capture_id?: string;
  completion_method: 'direct_paypal';
  idempotency_key: string;
  recipient_email: string;
  created_at: Timestamp;
  completed_at?: Timestamp;
  updated_at: Timestamp;
}

interface MonthlySpend {
  parent_id: string;
  month: string; // YYYY-MM format
  totalCents: number;
  limitCents: number;
  paymentCount: number;
  updated_at: Timestamp;
}
```

**Wellness Data System**
```typescript
interface WellnessEntry {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  mood: number; // 1-10 scale
  sleep_hours: number; // 0-24 hours
  exercise_minutes: number; // 0+ minutes
  nutrition: number; // 1-10 quality rating
  water: number; // 0-20 glasses
  social: number; // 1-10 interaction rating
  academic: number; // 1-10 productivity rating
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### Security Implementation

**Authentication and Authorization**
- Firebase Authentication with email/password verification
- Custom claims system with `admin`, `family_id`, `user_type`, and `initialized` tokens
- Family-based access control with role separation (parent/student)
- Session management with automatic token refresh
- Server-side document creation via `onUserCreated` Cloud Function trigger

**Data Protection Strategy**
- **Enterprise-grade Firestore Security Rules** with graduated permissions:
  - Registration-safe rules allowing `initialized` users basic access
  - Family isolation preventing cross-family data access
  - Server-only document creation (`allow create: if false` for sensitive collections)
- All payment operations require server-side authentication verification
- Sensitive financial data encrypted in transit using TLS 1.3
- PII data minimization with automatic data retention policies

**Payment Security Architecture**
- PayPal OAuth 2.0 with server-side credential management via Secret Manager
- All payment verification performed in Firebase Cloud Functions
- Webhook signature verification for PayPal payment notifications
- Idempotency key system prevents duplicate payment processing
- Comprehensive audit logging for regulatory compliance
- Rate limiting and fraud detection mechanisms

**Recent Security Enhancements (September 2025)**
- ✅ **Zero high-severity vulnerabilities** - All dependencies updated
- ✅ **Race condition elimination** - Proper server-client operation sequencing
- ✅ **Permission model hardening** - Strict Firestore rules with registration support
- ✅ **Server-side architecture** - Critical operations moved to Cloud Functions

### Performance and Scalability

**Caching and Data Management**
- Universal caching system with configurable TTL and cache invalidation
- Smart refresh pattern with stale-while-revalidate strategy
- Background data synchronization with conflict resolution
- Optimistic UI updates with automatic rollback on failure

**State Management Architecture**
- Zustand stores with persistence layer and automatic hydration
- Selective component re-rendering with computed value optimization
- Error boundary implementation for graceful failure handling
- Memory management with automatic cleanup of stale data

**Network Optimization**
- Request batching for multiple simultaneous data operations
- Automatic retry mechanisms with exponential backoff
- Offline capability with local data persistence
- Bandwidth optimization with data compression

## Development Environment

### Prerequisites and Setup
```bash
# Required Tools
node --version  # v18.17.0+
npm --version   # 9.6.7+
expo --version  # 6.3.2+

# Firebase CLI Setup
npm install -g firebase-tools
firebase login
firebase use campus-life-b0fd3
```

### Environment Configuration
```bash
# Firebase Project Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyExample123
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=campus-life-b0fd3.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=campus-life-b0fd3
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=campus-life-b0fd3.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# PayPal Sandbox Integration
EXPO_PUBLIC_PAYPAL_CLIENT_ID=AY123456789_sandbox_client_id
EXPO_PUBLIC_PAYPAL_CLIENT_SECRET=EL123456789_sandbox_secret
EXPO_PUBLIC_PAYPAL_ENVIRONMENT=sandbox

# Additional Services
EXPO_PUBLIC_RESEND_API_KEY=re_123456789_resend_api_key
```

### Build and Deployment Process
```bash
# Development Server
npm install
npx expo start --clear

# Firebase Functions Deployment (Updated Dependencies)
cd functions
npm install  # firebase-functions v6.4.0 + firebase-admin v13.5.0
npm run build
firebase deploy --only functions

# Firestore Rules and Indexes
firebase deploy --only firestore:rules,firestore:indexes

# Production Build (EAS)
eas build --platform android --profile production
eas build --platform ios --profile production
```

### Quick Start Commands
```bash
# Check for vulnerabilities (should show 0)
npm audit
cd functions && npm audit

# Test registration flow
node debug-registration.js  # Available in archive/ folder

# Deploy security updates
firebase deploy --only firestore:rules,functions
```

## API Documentation

### Firebase Cloud Functions

**createPayPalOrder**
```typescript
interface CreateOrderRequest {
  studentId: string;
  amountCents: number;
  note?: string;
}

interface CreateOrderResponse {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  approvalUrl?: string;
  error?: string;
}
```

**verifyPayPalPayment**
```typescript
interface VerifyPaymentRequest {
  transactionId: string;
  orderId: string;
  payerID?: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  status?: string;
  captureId?: string;
  message?: string;
  error?: string;
}
```

### Data Access Patterns

**Payment Flow Architecture**
1. Parent initiates payment through createPayPalP2POrder()
2. Firebase Function creates payment record with 'initiated' status
3. PayPal order generated with student email as recipient
4. Parent completes payment through PayPal web interface
5. PayPalP2PReturnHandler verifies payment completion
6. Firebase Function captures payment and updates status to 'completed'
7. PaymentReturnHandler calls confirmPayment() for budget updates
8. Student receives push notification confirmation

**Wellness Data Synchronization**
1. Student logs wellness metrics through WellnessLogScreen
2. Data validated client-side before submission
3. WellnessStore manages local state with optimistic updates
4. Firebase Cloud Functions validate and store wellness entries
5. Real-time listeners update parent dashboard views
6. Universal caching system maintains performance

## Production Considerations

### Security Compliance
- SOC 2 Type II compliance through Firebase infrastructure
- PCI DSS compliance through PayPal payment processing
- GDPR compliance with data minimization and user consent
- Regular security audits and penetration testing

### Monitoring and Analytics
- Firebase Performance Monitoring for app performance metrics
- Firebase Crashlytics for error tracking and crash reporting
- Custom analytics for user behavior and feature adoption
- Payment transaction monitoring with anomaly detection

### Scalability Planning
- Horizontal scaling through Firebase's managed infrastructure
- Database indexing optimization for query performance
- CDN integration for static asset delivery
- Load balancing for high-traffic scenarios

## Development Workflow

### Code Quality Standards
- TypeScript strict mode with comprehensive type coverage
- ESLint configuration with Expo and React Native rules
- Prettier for consistent code formatting
- Pre-commit hooks for automated quality checks

### Testing Strategy

**Production APK Testing Protocol**
- Multi-device testing with real Firebase backend integration
- Cross-device database synchronization validation
- Real-time notification delivery testing between devices
- Complete payment flow testing with sandbox PayPal integration
- Offline/online sync scenario testing
- Family workflow testing (parent-student interactions)

**Device Testing Checklist**
- Account registration and email verification flow
- Family linking with invite codes
- Real-time wellness data sync between parent/student devices  
- PayPal payment processing end-to-end
- Push notification delivery and preferences
- Message and support request functionality
- Caching behavior and performance validation

**Unit and Integration Testing**
- Unit testing for business logic and utility functions
- Integration testing for Firebase Cloud Functions
- End-to-end testing for critical payment flows
- Manual testing protocols for UI/UX validation

### Deployment Pipeline
- Continuous integration with automated testing
- Staged deployment with development → staging → production
- Automated rollback capabilities for critical failures
- Blue-green deployment strategy for zero-downtime updates

## 📁 Project Organization

### Core Application Structure
```
src/
├── components/           # Reusable UI components
├── screens/             # Screen components organized by user role
│   ├── auth/           # Authentication screens
│   ├── parent/         # Parent-specific screens
│   ├── student/        # Student-specific screens
│   └── shared/         # Shared screens (Profile, Settings)
├── stores/             # Zustand state management
├── lib/                # Firebase and utility functions
├── services/           # External service integrations
├── styles/             # Theme and styling
└── utils/              # Helper functions and caching

functions/              # Firebase Cloud Functions
├── src/
│   ├── index.ts        # Main functions export
│   ├── auth/           # Authentication triggers
│   ├── payment/        # PayPal integration
│   └── email/          # Email services

Configuration Files:
├── firestore.rules     # Security rules
├── App.tsx            # Root application component
├── CLAUDE.md          # Development guidelines
└── package.json       # Dependencies and scripts
```

### Key Features Implementation

**Loading States and UX**
- Smooth loading transitions during registration
- Pull-to-refresh on profile and dashboard screens
- 15-second auto-reload on activity screens
- Proper navigation flow without flicker

**PayPal Integration**
- PayPal.Me handle collection during registration
- Real-time payment processing with status updates
- Automatic Firebase Auth cleanup on registration failures
- Profile display of family member PayPal handles

**Security and Error Handling**
- Firebase Auth user cleanup on failed registrations
- Proper navigation reset handling after account deletion
- Enhanced email verification system
- Comprehensive error boundary implementation

## 🔧 Recent Updates (September 2025)

### User Experience Enhancements
- **Smooth Loading Screens**: Added comprehensive loading states during registration and app initialization
- **Pull-to-Refresh**: Implemented manual refresh functionality on profile and dashboard screens
- **Auto-Reload Optimization**: Enhanced activity page with configurable 15-second auto-refresh
- **Navigation Improvements**: Fixed flickering and navigation reset errors after account operations

### PayPal Integration Improvements
- **Registration Integration**: Added PayPal.Me handle collection during student registration
- **Profile Display**: Family members' PayPal handles now visible in profile section
- **Error Recovery**: Proper Firebase Auth cleanup when registration fails
- **Real-time Updates**: Smooth transitions between payment states

### Code Quality and Cleanup
- **Project Organization**: Removed debug files, test scripts, and development artifacts
- **Error Handling**: Enhanced navigation error handling and user feedback
- **Performance**: Optimized loading states and prevented duplicate initialization
- **Security**: Implemented proper cleanup mechanisms for failed authentication attempts

### Technical Debt Reduction
- **File Organization**: Cleaned and streamlined project structure
- **Documentation**: Updated README with current architecture and feature set
- **Dependencies**: Maintained security updates and vulnerability patches
- **Testing**: Removed obsolete test files and debugging scripts

### Production Readiness
- ✅ **Clean Codebase**: All debug and test files archived and removed
- ✅ **Smooth UX**: Loading states and transitions optimized
- ✅ **Error Recovery**: Proper handling of failed operations
- ✅ **Security**: Firebase Auth cleanup and proper navigation flows