# CampusLife - Family Wellness Tracker

A cross-platform native app focused on family connection and wellness tracking with gamification elements.

## 🎯 Product Vision

**Connection-First Family Wellness**: CampusLife emphasizes family support, encouragement, and connection over transactional rewards. The app helps families stay connected while promoting healthy habits through gamification.

### Core Features
- **Wellness Tracking**: Sleep, meals, exercise, hydration, study time
- **Family Connection**: Support messages, care packages, video calls, mood tracking
- **Gamification**: Levels, experience points, streaks, achievements
- **Family Dashboard**: Parents can monitor wellness and send encouragement

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Expo CLI
- Expo Go app on your phone

### Installation
```bash
npm install
npx expo start
```

Scan the QR code with Expo Go to run the app on your device.

## 📱 Current Status

✅ **Working Features**:
- Basic app structure with navigation
- Student dashboard with wellness tracking
- Family connection features (support messages, mood tracking)
- Gamification system (levels, experience, rewards)
- Minimal dependencies for stability

🔄 **In Development**:
- Authentication system
- Parent dashboard
- Real-time data sync
- Push notifications

## 🏗️ Architecture

- **Frontend**: React Native with Expo
- **State Management**: Zustand
- **Navigation**: React Navigation
- **UI**: React Native built-in components
- **Backend**: Supabase (planned)

## 📊 Wellness Tracking

The app tracks:
- **Sleep**: Hours per night with streak tracking
- **Meals**: Daily meal count and consistency
- **Exercise**: Minutes of activity per day
- **Hydration**: Water intake tracking
- **Study Time**: Academic focus hours

## 🎮 Gamification

- **Levels**: Freshman → Sophomore → Junior → Senior → Graduate
- **Experience Points**: Earned through wellness activities
- **Streaks**: Maintain healthy habits for consecutive days
- **Achievements**: Unlock rewards for milestones
- **Family Support**: Receive encouragement and care packages

## 💝 Family Connection

- **Support Messages**: Parents can send encouraging messages
- **Care Packages**: Schedule surprise deliveries
- **Video Calls**: Coordinate family check-ins
- **Mood Tracking**: Share emotional well-being
- **Wellness Monitoring**: Parents can view progress

## 🔧 Development

### Project Structure
```
src/
├── navigation/     # Navigation components
├── screens/        # Screen components
│   ├── student/    # Student-facing screens
│   └── parent/     # Parent-facing screens
├── stores/         # Zustand state management
└── lib/           # Utilities and configurations
```

### Key Dependencies
- `expo`: Cross-platform development
- `@react-navigation`: Navigation system
- `zustand`: State management
- `@expo/vector-icons`: Icon library

## 🎯 Next Steps

1. **Authentication**: Implement user registration and login
2. **Parent Dashboard**: Create parent-specific screens
3. **Real-time Sync**: Connect to Supabase backend
4. **Push Notifications**: Alert for support messages
5. **Wellness Logging**: Complete the logging interface

## 💡 Monetization Strategy

**Connection-First Model**:
- Free tier: Basic wellness tracking and family connection
- Premium features: Advanced analytics, unlimited care packages, priority support
- Focus on value through connection rather than transactional rewards

---

*Building stronger families through wellness and connection* 🌟 