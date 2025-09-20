import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { StatusHeader } from '../../components/StatusHeader';
import { TermsAndConditions } from '../../components/TermsAndConditions';
import { theme } from '../../styles/theme';

type TermsAndConditionsScreenProps = StackScreenProps<any, 'TermsAndConditions'>;

export const TermsAndConditionsScreen: React.FC<TermsAndConditionsScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusHeader
        title="Terms & Conditions"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      <TermsAndConditions />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});