# Campus Life App - Architecture & Features Documentation

## Overview
Campus Life is a React Native/Expo mobile application that connects parents and students to track wellness, manage payments, and facilitate family communication. The app uses Firebase as its backend for authentication, data storage, and push notifications.

## Core Architecture

### Technology Stack
- **Framework**: React Native 0.79.5 with Expo SDK ~53.0.20
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand stores with persistence
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, Push Notifications)
- **Payments**: Multi-provider support (PayPal, Venmo, CashApp, Zelle)
- **Navigation**: React Navigation 6 with deep linking
- **UI Components**: Custom components with react-native-gifted-charts for data visualization
- **Build System**: EAS Build for deployment
- **Caching**: Custom AsyncStorage-based universal caching system

### Project Structure
```
src/
├── components/           # Reusable UI components
│   ├── cards/           # Dashboard cards and UI elements
│   ├── charts/          # Wellness data visualization components
│   └── common/          # Shared UI components
├── lib/                 # Firebase configuration and utilities
├── navigation/          # Navigation configuration (Student/Parent stacks)
├── screens/            # Screen components organized by user type
│   ├── auth/           # Authentication and onboarding
│   ├── parent/         # Parent-specific screens
│   ├── student/        # Student-specific screens
│   ├── shared/         # Shared screens (Profile, etc.)
│   └── wellness/       # Wellness tracking screens
├── services/           # External services and integrations
├── stores/             # Zustand state management
├── styles/             # Theme and styling system
└── utils/              # Helper utilities, caching, and data transformation
```

## User Types & Authentication

### Parent Users
- Can have multiple students in their family
- Manage payments and rewards through multiple payment providers
- View student wellness data with analytics
- Send support messages and manage family communications
- Manage family member approvals and subscriptions
- Access to comprehensive activity history

### Student Users
- Part of a family group with parent oversight
- Daily wellness tracking with ranking system
- Request support from parents with custom messages
- View rewards, achievements, and XP progress
- Access to personal analytics and insights

### Family System
- Each family has a unique `family_id`
- Parents approve student join requests
- **Maximum 10 students per family limit** (enforced at application and database level)
- All family data is scoped by family ID with strict security rules
- Email verification required for all users

## Key Features & Implementation

### 1. User Authentication & Family Management
**Files**: `src/screens/auth/`, `src/stores/authStore.ts`
- Firebase Authentication with email/password and verification
- Role-based registration flows for parents and students
- Family creation and joining system with approval workflow
- Password reset functionality with email confirmation
- Deep linking support for email verification

**Key Components**:
- `LoginScreen.tsx`: Unified login with role detection
- `StudentRegisterScreen.tsx`: Student registration with family join requests
- `ParentRegisterScreen.tsx`: Parent registration and family creation
- `FamilyJoinRequestsScreen.tsx`: Parent approval interface
- `EmailVerificationScreen.tsx`: Email verification flow

### 2. Advanced Wellness Tracking & Analytics
**Files**: `src/screens/wellness/`, `src/stores/wellnessStore.ts`, `src/components/charts/`, `src/utils/chartDataTransform.ts`

**Core System**:
- **Ranking-based logging**: Students rank 4 categories (Sleep, Nutrition, Academics, Social) from best to worst performing
- **Overall mood tracking**: 1-10 slider for general day quality
- **Smart scoring algorithm**: Combines ranking + mood with weighted calculation
- **Advanced analytics**: Multi-line charts, trend analysis, insights dashboard
- **Time filtering**: Daily, weekly, monthly views with data aggregation
- **Streak tracking**: Current and longest streaks with gamification

**Key Screens**:
- `WellnessLogScreen.tsx`: Daily wellness entry with intuitive ranking interface
- `WellnessHistoryScreen.tsx`: Advanced analytics dashboard with professional charts
- `LogWellnessScreen.tsx`: Wellness overview and quick actions

**Data Visualization**:
- **Overall Wellness Score Chart**: Line chart with gradient fill, 1-10 scale, continuous timeline
- **Category Performance Chart**: Multi-line chart showing ranking trends, interactive legend, 1-4 scale
- **Professional styling**: Clean cards, muted colors, responsive design, accessibility support

**Data Structure**:
```typescript
interface WellnessEntry {
  id: string;
  date: string;
  rankings: {
    sleep: number;      // 1-4 (1=best performing, 4=worst performing)
    nutrition: number;  // 1-4  
    academics: number;  // 1-4
    social: number;     // 1-4
  };
  overallMood: number; // 1-10 slider for general day quality
  notes?: string;
  overallScore: number; // calculated from rankings + mood
}
```

### 3. Multi-Provider Payment System
**Files**: `src/screens/parent/SendPaymentScreen.tsx`, `src/lib/paypalP2P.ts`, `src/stores/rewardsStore.ts`
- **Multiple payment providers**: PayPal, Venmo, CashApp, Zelle
- **PayPal P2P integration**: Full API integration with order creation and capture
- **Payment verification**: Server-side verification through Firebase Cloud Functions
- **Monthly limits**: Spending caps and tracking per parent
- **Payment history**: Comprehensive transaction tracking

**Payment Flow**:
1. Parent selects provider and creates payment with amount and recipient
2. Provider-specific integration (PayPal API, deep linking for others)
3. Return flow handling through deep linking
4. Firebase Cloud Function verifies payment status
5. Activity history updated with detailed payment information

### 4. Comprehensive Support & Communication System
**Files**: `src/screens/parent/SendSupportScreen.tsx`, `src/stores/rewardsStore.ts`
- **Bidirectional messaging**: Students request support, parents respond
- **Custom message system**: Personalized support requests with context
- **Real-time notifications**: Push notifications for immediate alerts
- **Message threading**: Conversation history between family members
- **Activity integration**: All communications logged in unified feed

**Support Flow**:
1. Student triggers support request from dashboard
2. Custom message modal with 2000 character limit
3. Firebase stores request with family and user context
4. Push notifications sent to all parents in family
5. Parents view and acknowledge through activity history
6. Response tracking and conversation threading

### 5. Gamification & Rewards System
**Files**: `src/stores/rewardsStore.ts`, `src/screens/student/`
- **XP system**: Points awarded for wellness logging and positive activities
- **Achievement tracking**: Streak milestones and wellness goals
- **Level progression**: Student advancement through consistent logging
- **Reward correlation**: XP tied to wellness scores and consistency
- **Progress visualization**: Charts and progress indicators

### 6. Activity History & Notifications
**Files**: `src/screens/parent/ActivityHistoryScreen.tsx`, `src/services/pushNotificationService.ts`
- **Unified activity feed**: All family interactions in one timeline
- **Rich categorization**: Payments, messages, support requests, wellness updates
- **Real-time updates**: Push notifications with customizable preferences
- **Advanced filtering**: Date ranges, categories, family member filters
- **Export capabilities**: Activity data export for record keeping

**Activity Types**:
- `payment`: Multi-provider transactions with status tracking
- `message`: Support communications between family members  
- `support_request`: Student care requests with custom messages and responses
- `wellness`: Daily logging notifications and milestone achievements
- `item`: General family updates and system notifications

## Firebase Architecture

### Firestore Collections

#### `users`
- Complete user profiles with `user_type` (parent/student)
- Family associations via `family_id`
- Push notification tokens and preferences
- Email verification status and timestamps
- Device information for push notifications

#### `profiles`
- Extended user profile information
- Privacy settings and preferences
- Family role definitions

#### `families`
- Family metadata, settings, and member limits
- Parent and student ID arrays
- Family invite codes for joining
- Subscription status and limits

#### `family_join_requests`
- Pending student join requests with approval workflow
- Request context and family information
- Automatic cleanup after approval/denial

#### `payments`
- Multi-provider payment records with detailed status tracking
- PayPal order IDs and capture information
- Parent-student payment relationships with amount limits
- Monthly spending tracking and limits

#### `transactions`
- Detailed transaction records for all payment providers
- PayPal integration data and webhook verification
- Transaction status history and audit trail

#### `support_requests`
- Student support requests with rich context and custom messages
- Family-scoped with acknowledgment and response tracking
- Message threading and conversation history

#### `messages`
- Direct messages between family members
- Read status, timestamps, and delivery confirmation
- Message categories and priority levels

#### `wellness_entries`
- Daily wellness data per student with ranking system
- Calculated overall scores and mood tracking
- Analytics data and trend calculations
- Streak tracking and milestone data

#### `user_progress`
- XP tracking and level progression
- Achievement unlocks and milestone dates
- Gamification data and reward history

#### `push_tokens`
- Device-specific push notification tokens
- Platform information and token refresh tracking
- User preference mapping

### Security Rules
**File**: `firestore.rules`
- **Family-based data isolation**: Strict access control by family membership
- **Role-based permissions**: Different access levels for parents vs students
- **Email verification enforcement**: Required for sensitive operations
- **Data validation**: Comprehensive field validation and sanitization
- **Audit logging**: Security event tracking and monitoring

### Cloud Functions
**File**: `functions/src/index.ts`
- `verifyPayPalPayment`: PayPal webhook verification and payment processing
- `sendPushNotification`: Centralized notification delivery system
- `processWellnessEntry`: Wellness data validation and analytics calculations
- `manageFamilyLimits`: Enforcement of family size and subscription limits
- Cross-collection data consistency and integrity checks

## State Management (Zustand Stores)

### `authStore.ts`
- Complete authentication state management
- User profile and family membership tracking
- Login/logout flows with persistence
- Email verification status management

### `wellnessStore.ts`
- **Advanced wellness tracking**: Entry management with ranking system
- **Smart caching**: Intelligent data loading with cache strategies
- **Analytics calculations**: Trend analysis and insight generation  
- **Real-time updates**: Optimistic updates with background sync
- **Streak management**: Current and historical streak calculations

### `rewardsStore.ts`
- Payment tracking across multiple providers
- XP and achievement management
- Support message coordination
- Activity history aggregation and filtering
- Monthly earning calculations and limit enforcement

## Navigation Structure

### Parent Navigation (`ParentNavigator.tsx`)
- **Dashboard**: Comprehensive family overview with wellness insights
- **Activity**: Advanced activity feed with filtering and search
- **Send Payment**: Multi-provider payment interface
- **Family Management**: Member approval and family settings
- **Student Wellness**: Detailed analytics for each student

### Student Navigation (`StudentNavigator.tsx`)
- **Dashboard**: Personal wellness overview and support tools
- **Wellness**: Advanced analytics dashboard with interactive charts
- **Log Wellness**: Daily tracking interface with ranking system
- **Rewards**: XP progress, achievements, and level tracking
- **Profile**: Personal settings and family information

## Performance & Optimization

### Caching System (`utils/universalCache.ts`)
- **Smart refresh patterns**: Instant loading with background updates
- **Multi-layered caching**: Memory, AsyncStorage, and network layers
- **Cache invalidation**: Intelligent cache management and cleanup
- **Offline support**: Graceful degradation when network unavailable
- **Performance monitoring**: Cache hit rates and performance metrics

### Data Management
- **Optimistic updates**: Immediate UI updates with background sync
- **Batch operations**: Efficient bulk data operations
- **Lazy loading**: Component-level lazy loading for performance
- **Memory management**: Proper cleanup and garbage collection

## Key Utilities & Services

### Chart Data Transformation (`utils/chartDataTransform.ts`)
- **Data aggregation**: Daily, weekly, monthly data grouping
- **Trend calculations**: Statistical analysis and insights generation
- **Chart formatting**: Data preparation for visualization libraries
- **Date handling**: Timezone-aware date processing
- **Performance optimization**: Efficient data transformation algorithms

### PayPal Integration (`lib/paypalP2P.ts`)
- **Complete P2P payment flow**: Order creation, payment processing, capture
- **Webhook handling**: Server-side payment verification
- **Error recovery**: Comprehensive error handling and retry logic
- **Deep linking**: Seamless app return flow after payment

### Push Notifications (`services/pushNotificationService.ts`)
- **Cross-platform delivery**: iOS and Android notification support
- **Template system**: Reusable notification templates with personalization
- **Scheduling**: Delayed and recurring notification support
- **Analytics**: Delivery tracking and engagement metrics

## Build & Deployment

### EAS Build Configuration
- **Production builds**: Optimized builds for app store deployment
- **Development builds**: Debug builds with development tools
- **Environment management**: Separate configs for dev/staging/production
- **Automated building**: CI/CD integration with GitHub Actions

### Environment Configuration
- **Firebase projects**: Separate environments for development and production
- **API keys management**: Secure credential handling
- **Feature flags**: Environment-specific feature toggles
- **Monitoring integration**: Crash reporting and performance monitoring

## Security Considerations

### Data Protection
- **End-to-end encryption**: Sensitive data encryption in transit and at rest
- **Input validation**: Comprehensive sanitization and validation
- **SQL injection prevention**: Parameterized queries and safe data handling
- **XSS protection**: Output encoding and content security policies

### Authentication Security
- **Email verification**: Required for account activation
- **Password policies**: Strong password requirements and validation
- **Session management**: Secure token handling and refresh
- **Multi-factor authentication**: Optional 2FA for enhanced security

### Privacy Compliance
- **Data minimization**: Collection of only necessary user data
- **User consent**: Clear privacy policies and consent mechanisms
- **Data retention**: Automated cleanup of old and unnecessary data
- **Export capabilities**: User data export for compliance requirements

## Development Guidelines

### Code Quality Standards
- **TypeScript strict mode**: Full type safety and compile-time validation
- **ESLint configuration**: Consistent code style and error prevention
- **Component patterns**: Functional components with proper hook usage
- **Error boundaries**: Comprehensive error handling and recovery
- **Testing strategy**: Unit and integration test coverage

### UI/UX Standards
- **Design system**: Consistent theming and component library
- **Accessibility**: WCAG compliance and screen reader support
- **Responsive design**: Adaptive layouts for various screen sizes
- **Loading states**: Progressive loading and skeleton screens
- **Error handling**: User-friendly error messages and recovery options

### Performance Standards
- **Bundle optimization**: Code splitting and lazy loading
- **Image optimization**: Compressed images and proper caching
- **Network efficiency**: Request batching and caching strategies
- **Memory management**: Proper cleanup and leak prevention

## Recent Major Updates

### Wellness Analytics Overhaul
- **Complete redesign**: From basic list view to professional analytics dashboard
- **Ranking system**: Intuitive category ranking instead of complex scoring
- **Advanced charts**: Multi-line category performance and overall score visualization
- **Interactive features**: Toggleable chart series and responsive design
- **Professional styling**: Dashboard-quality design with proper accessibility

### Payment System Enhancement
- **Multi-provider support**: Added Venmo, CashApp, and Zelle alongside PayPal
- **Improved UX**: Streamlined payment flow with better error handling
- **Enhanced security**: Server-side verification and fraud prevention
- **Monthly limits**: Comprehensive spending tracking and limit enforcement

### Family Management Improvements
- **Enhanced approval workflow**: Better parent controls for family membership
- **Member limit enforcement**: Strict 10-student limit with proper validation
- **Communication improvements**: Rich messaging system with custom templates
- **Activity tracking**: Comprehensive audit trail for all family activities

This architecture represents a production-ready, scalable family wellness and communication platform with enterprise-level security, comprehensive analytics, and multi-provider payment integration.