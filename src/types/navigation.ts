import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// Root Stack Parameter List (Main App Navigation)
export type RootStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  ParentRegister: undefined;
  StudentRegister: undefined;
  StudentTabs: undefined;
  ParentTabs: undefined;
};

// Auth Stack Parameter List
export type AuthStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  ParentRegister: undefined;
  StudentRegister: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// Student Tab Parameter List
export type StudentTabParamList = {
  Dashboard: undefined;
  Log: undefined;
  Rewards: undefined;
  Profile: undefined;
};

// Student Dashboard Stack Parameter List
export type StudentDashboardStackParamList = {
  DashboardMain: undefined;
  WellnessLog: undefined;
  WellnessHistory: undefined;
};

// Parent Tab Parameter List  
export type ParentTabParamList = {
  Dashboard: undefined;
  ChildWellness: undefined;
  SendSupport: {
    preselectedType?: 'message' | 'voice' | 'boost';
    selectedStudentId?: string;
    selectedStudentName?: string;
  };
  Profile: undefined;
};

// Generic Navigation Props
export type AuthStackNavigationProp<T extends keyof AuthStackParamList> = StackNavigationProp<AuthStackParamList, T>;
export type AuthStackRouteProp<T extends keyof AuthStackParamList> = RouteProp<AuthStackParamList, T>;

export type StudentTabNavigationProp<T extends keyof StudentTabParamList> = BottomTabNavigationProp<StudentTabParamList, T>;
export type StudentTabRouteProp<T extends keyof StudentTabParamList> = RouteProp<StudentTabParamList, T>;

export type StudentDashboardStackNavigationProp<T extends keyof StudentDashboardStackParamList> = StackNavigationProp<StudentDashboardStackParamList, T>;
export type StudentDashboardStackRouteProp<T extends keyof StudentDashboardStackParamList> = RouteProp<StudentDashboardStackParamList, T>;

export type ParentTabNavigationProp<T extends keyof ParentTabParamList> = BottomTabNavigationProp<ParentTabParamList, T>;
export type ParentTabRouteProp<T extends keyof ParentTabParamList> = RouteProp<ParentTabParamList, T>;

// Combined Navigation Props for Screen Components
export type AuthScreenProps<T extends keyof AuthStackParamList> = {
  navigation: AuthStackNavigationProp<T>;
  route: AuthStackRouteProp<T>;
};

export type StudentScreenProps<T extends keyof StudentTabParamList> = {
  navigation: StudentTabNavigationProp<T>;
  route: StudentTabRouteProp<T>;
};

export type StudentDashboardScreenProps<T extends keyof StudentDashboardStackParamList> = {
  navigation: StudentDashboardStackNavigationProp<T>;
  route: StudentDashboardStackRouteProp<T>;
};

export type ParentScreenProps<T extends keyof ParentTabParamList> = {
  navigation: ParentTabNavigationProp<T>;
  route: ParentTabRouteProp<T>;
};