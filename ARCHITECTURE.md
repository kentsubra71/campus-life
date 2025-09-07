# Campus Life App - Architecture & Features Documentation

## Overview
Campus Life is a React Native mobile application that connects parents and students to track wellness, manage rewards, and facilitate family communication. The app uses Firebase as its backend for authentication, data storage, and push notifications.

## Core Architecture

### Technology Stack
- **Frontend**: React Native with TypeScript
- **State Management**: Zustand stores
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, Push Notifications)
- **Payments**: PayPal P2P integration
- **Navigation**: React Navigation 6
- **UI Components**: Custom components with React Native elements

### Project Structure
```
src/
├── components/           # Reusable UI components
├── lib/                 # Firebase configuration and utilities
├── navigation/          # Navigation configuration (Student/Parent stacks)
├── screens/            # Screen components organized by user type
├── services/           # External services (PayPal, push notifications)
├── stores/             # Zustand state management
├── styles/             # Theme and styling
└── utils/              # Helper utilities and caching
```

## User Types & Authentication

### Parent Users
- Can have multiple students in their family
- Manage payments and rewards
- View student wellness data
- Send support messages
- Approve new family members

### Student Users
- Part of a family group
- Track daily wellness metrics
- Request support from parents
- View rewards and achievements

### Family System
- Each family has a unique `family_id`
- Parents can approve student join requests
- **Maximum 10 students per family limit**
- All family data is scoped by family ID

## Key Features & Implementation

### 1. User Authentication & Family Management
**Files**: `src/screens/auth/`, `src/stores/authStore.ts`
- Firebase Authentication with email/password
- Family creation and joining system
- Parent approval required for new students
- Role-based navigation (Parent vs Student tabs)

**Key Components**:
- `LoginScreen.tsx`: Unified login for both user types
- `StudentRegisterScreen.tsx`: Student registration with family join requests
- `ParentRegisterScreen.tsx`: Parent registration and family creation
- `FamilyJoinRequestsScreen.tsx`: Parent interface to approve/deny student join requests

### 2. Wellness Tracking System
**Files**: `src/screens/wellness/`, `src/stores/wellnessStore.ts`
- Daily wellness logging with mood tracking
- Category ranking system (sleep, nutrition, academics, social)
- Streak tracking and progress metrics
- Historical wellness data visualization

**Key Screens**:
- `WellnessLogScreen.tsx`: Daily wellness entry with sliders and ranking
- `WellnessHistoryScreen.tsx`: Historical wellness data view
- `LogWellnessScreen.tsx`: Overview and quick actions for wellness tracking

**Data Structure**:
```typescript
interface WellnessEntry {
  id: string;
  date: string;
  rankings: { sleep: number; nutrition: number; academics: number; social: number; };
  overallMood: number; // 1-10 scale
  notes?: string;
  userId: string;
  familyId: string;
}
```

### 3. Rewards & Payment System
**Files**: `src/screens/parent/SendPaymentScreen.tsx`, `src/lib/paypalP2P.ts`, `src/stores/rewardsStore.ts`
- PayPal P2P integration for parent-to-student payments
- Reward tracking and point systems
- Monthly earning caps and limits
- Payment history and activity tracking

**Payment Flow**:
1. Parent creates payment with amount and recipient
2. PayPal P2P API initiates payment
3. Deep linking handles return from PayPal
4. Firebase Cloud Function verifies payment
5. Activity history updated with payment status

**Key Components**:
- `SendPaymentScreen.tsx`: Payment creation interface
- `PayPalP2PReturnHandler.tsx`: Handles PayPal return flow
- `ActivityHistoryScreen.tsx`: Payment history display

### 4. Support & Communication System
**Files**: `src/screens/parent/SendSupportScreen.tsx`, `src/stores/rewardsStore.ts`
- Students can request support with custom messages
- Parents receive push notifications for support requests
- Message threading between family members
- Activity history integration for all communications

**Support Flow**:
1. Student triggers support request from dashboard
2. Custom message modal allows personalized requests
3. Firebase stores support request with family context
4. Push notifications sent to all parents in family
5. Parents can view and acknowledge support requests
6. All interactions logged in activity history

### 5. Activity History & Notifications
**Files**: `src/screens/parent/ActivityHistoryScreen.tsx`, `src/services/pushNotificationService.ts`
- Unified activity feed for all family interactions
- Categories: payments, messages, support requests, items
- Real-time push notifications for important events
- Filtering and search functionality

**Activity Types**:
- `payment`: PayPal transactions and status updates
- `message`: Support messages between family members  
- `support_request`: Student care requests with custom messages
- `item`: General family items and updates

## Firebase Architecture

### Firestore Collections

#### `users`
- User profiles with `user_type` (parent/student)
- Family associations via `family_id`
- Push notification tokens

#### `families`
- Family metadata and settings
- Created by parent registration

#### `family_join_requests`
- Pending student join requests
- Requires parent approval before family membership

#### `payments`
- PayPal payment records
- Status tracking (pending, completed, failed)
- Parent-student payment relationships

#### `transactions` 
- P2P payment transaction details
- PayPal integration data

#### `support_requests`
- Student support requests with custom messages
- Family-scoped with acknowledgment tracking

#### `messages`
- Support messages between family members
- Read status and timestamp tracking

#### `wellness_entries`
- Daily wellness data per student
- Mood tracking and category rankings

### Security Rules
**File**: `firestore.rules`
- Family-based data isolation
- Role-based access control
- User can only access their family's data
- Parents have broader access within family scope

### Cloud Functions
**File**: `functions/src/index.ts`
- `verifyPayPalPayment`: Handles PayPal webhook verification
- Payment status updates and notifications
- Cross-collection payment record management

## State Management (Zustand Stores)

### `authStore.ts`
- User authentication state
- Profile management
- Login/logout functionality

### `wellnessStore.ts`
- Wellness entry management
- Streak calculations
- Historical data caching

### `rewardsStore.ts`
- Payment and reward tracking
- Support message management
- Activity history aggregation
- Monthly earning calculations

## Navigation Structure

### Parent Navigation (`ParentNavigator.tsx`)
- **Dashboard**: Overview of family activity
- **Activity**: Payment and communication history  
- **Send Payment**: PayPal payment interface
- **Send Support**: Message sending to students
- **Family Join Requests**: Approve new family members

### Student Navigation (`StudentNavigator.tsx`)
- **Dashboard**: Wellness overview and support requests
- **Wellness**: Daily tracking and history
- **Rewards**: Achievement and earnings display

## Key Utilities & Services

### Caching System (`utils/universalCache.ts`)
- Intelligent caching for Firebase data
- Reduces API calls and improves performance
- Cache invalidation strategies

### PayPal Integration (`lib/paypalP2P.ts`)
- P2P payment creation and verification
- Deep linking integration
- Error handling and retry logic

### Push Notifications (`services/pushNotificationService.ts`)
- Cross-platform notification delivery
- Template-based notification system
- Family-scoped notification targeting

## Development Guidelines

### Code Patterns
- TypeScript for type safety
- Functional components with hooks
- Zustand for global state management
- Consistent error handling and user feedback

### UI/UX Standards
- Dark theme with consistent color palette
- Responsive design for various screen sizes
- Loading states and error boundaries
- 2000 character limits on text inputs for wellness and support messages

### Security Considerations
- Firebase security rules enforce data isolation
- No sensitive data in client-side code
- Payment verification through server-side functions
- Input validation and sanitization

## Recent Updates & Features

### Parent Approval System
- New family join request workflow
- Enhanced security for family membership
- **10 student per family limit enforced at both application and database level**
- Firebase rule updates for proper access control

### Custom Support Messages
- Students can send personalized support requests
- Integration with activity history
- Push notification improvements

### PayPal Integration Improvements
- Simplified return flow handling
- Better error recovery and user experience
- Firebase function updates for payment verification

### Character Limits
- 2000 character limits on support messages and wellness text inputs
- 140 character limit on payment notes
- Consistent input validation across the app

## File Organization Summary

### Core Screens by User Type
**Parent Screens**:
- `ParentDashboardScreen.tsx`: Family overview and quick actions
- `ActivityHistoryScreen.tsx`: Complete family activity feed
- `SendPaymentScreen.tsx`: PayPal payment creation
- `SendSupportScreen.tsx`: Message sending interface
- `FamilyJoinRequestsScreen.tsx`: Approve new family members
- `ChildWellnessScreen.tsx`: View student wellness data

**Student Screens**:
- `DashboardScreen.tsx`: Personal wellness overview and support requests
- `WellnessLogScreen.tsx`: Daily wellness entry interface
- `LogWellnessScreen.tsx`: Wellness tracking dashboard
- `WellnessHistoryScreen.tsx`: Personal wellness history

**Shared Screens**:
- `ProfileScreen.tsx`: User profile management
- Authentication screens in `src/screens/auth/`

### Key Components
- `PayPalP2PReturnHandler.tsx`: Handles PayPal return flow with simplified UX
- Navigation components in `src/navigation/`

This architecture supports a scalable, family-centric wellness and communication platform with secure payment integration and comprehensive activity tracking.