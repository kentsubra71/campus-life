import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../constants/themes';
import { useWellnessStore } from '../../stores/wellnessStore';

export const LogWellnessScreen = () => {
  const { theme } = useTheme();
  const { addEntry } = useWellnessStore();
  const [mood, setMood] = useState<number>(5);
  const [energy, setEnergy] = useState<number>(5);
  const [sleep, setSleep] = useState<number>(8);
  const [stress, setStress] = useState<number>(3);
  const [notes, setNotes] = useState<string>('');
  
  const styles = createStyles(theme);

  const moodEmojis = ['😭', '😢', '😐', '😊', '😍'];
  const energyLevels = ['💀', '😴', '😐', '⚡', '🔥'];
  
  const handleSubmit = () => {
    const wellnessScore = ((mood + energy + (10 - stress) + (sleep / 1.2)) / 4);
    
    const entry = {
      id: Date.now().toString(),
      date: new Date(),
      mood,
      energy,
      sleep,
      stress,
      wellnessScore,
      notes,
    };

    addEntry(entry);
    Alert.alert(
      'Wellness Logged!', 
      `Your wellness score today is ${Math.round(wellnessScore * 10) / 10}/10`,
      [
        { 
          text: 'OK', 
          onPress: () => {
            setMood(5);
            setEnergy(5);
            setSleep(8);
            setStress(3);
            setNotes('');
          }
        }
      ]
    );
  };

  const renderScale = (
    title: string, 
    value: number, 
    setValue: (value: number) => void, 
    min: number, 
    max: number, 
    emoji?: string[]
  ) => (
    <View style={styles.scaleContainer}>
      <View style={styles.scaleHeader}>
        <Text style={styles.scaleTitle}>{title}</Text>
        <Text style={styles.scaleValue}>
          {emoji ? emoji[Math.min(Math.floor(value) - 1, emoji.length - 1)] : value}
        </Text>
      </View>
      <View style={styles.scaleTrack}>
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.scaleButton,
              value === num && styles.scaleButtonActive
            ]}
            onPress={() => setValue(num)}
          >
            <Text style={[
              styles.scaleButtonText,
              value === num && styles.scaleButtonTextActive
            ]}>
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Wellness Check</Text>
        <Text style={styles.subtitle}>How are you feeling today?</Text>
      </View>

      <View style={styles.section}>
        {renderScale('Mood', mood, setMood, 1, 5, moodEmojis)}
        {renderScale('Energy Level', energy, setEnergy, 1, 5, energyLevels)}
        {renderScale('Hours of Sleep', sleep, setSleep, 4, 12)}
        {renderScale('Stress Level', stress, setStress, 1, 5)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="How are you feeling today? Any thoughts or concerns?"
          placeholderTextColor={theme.colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.sectionTitle}>Wellness Preview</Text>
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Mood:</Text>
            <Text style={styles.previewValue}>{moodEmojis[mood - 1]} {mood}/5</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Energy:</Text>
            <Text style={styles.previewValue}>{energyLevels[energy - 1]} {energy}/5</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Sleep:</Text>
            <Text style={styles.previewValue}>😴 {sleep} hours</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Stress:</Text>
            <Text style={styles.previewValue}>😰 {stress}/5</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Wellness Score:</Text>
            <Text style={[styles.previewValue, styles.scoreValue]}>
              {Math.round(((mood + energy + (10 - stress) + (sleep / 1.2)) / 4) * 10) / 10}/10
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <MaterialIcons name="check" size={24} color="white" />
        <Text style={styles.submitButtonText}>Log Today's Wellness</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  scaleContainer: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scaleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  scaleValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  scaleTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  scaleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  scaleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  scaleButtonTextActive: {
    color: 'white',
  },
  notesInput: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 100,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewSection: {
    padding: 20,
    paddingTop: 0,
  },
  previewCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  previewValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    margin: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 20,
  },
}); 