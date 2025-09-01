import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { PrivacyPolicy } from '../../components/PrivacyPolicy';

interface PrivacyPolicyScreenProps {
  navigation: any;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
      
      <PrivacyPolicy />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});