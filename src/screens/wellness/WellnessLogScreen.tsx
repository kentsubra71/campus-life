import React, { useState, useEffect } from 'react';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { showMessage } from 'react-native-flash-message';
import { useWellnessStore, WellnessEntry } from '../../stores/wellnessStore';
import { getTodayDateString, formatDateForDisplay } from '../../utils/dateUtils';

interface WellnessLogScreenProps {
  navigation: any;
}

const WellnessLogScreen: React.FC<WellnessLogScreenProps> = ({ navigation }) => {
  const { addEntry, updateEntry, getEntryByDate, todayEntry } = useWellnessStore();
  const [formData, setFormData] = useState({
    mood: 5,
    sleep: 7,
    exercise: 30,
    nutrition: 5,
    water: 6,
    social: 5,
    academic: 5,
    notes: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const today = getTodayDateString();
    const existingEntry = getEntryByDate(today);
    
    if (existingEntry) {
      setFormData({
        mood: existingEntry.mood,
        sleep: existingEntry.sleep,
        exercise: existingEntry.exercise,
        nutrition: existingEntry.nutrition,
        water: existingEntry.water,
        social: existingEntry.social,
        academic: existingEntry.academic,
        notes: existingEntry.notes || '',
      });
      setIsEditing(true);
    }
  }, []);

  const handleSave = async () => {
    const today = getTodayDateString();
    
    try {
      if (isEditing && todayEntry) {
        await updateEntry(todayEntry.id, {
          ...formData,
          date: today,
        });
        showMessage({
          message: 'Success',
          description: 'Wellness entry updated successfully!',
          type: 'success',
          backgroundColor: theme.colors.success,
          color: theme.colors.backgroundSecondary,
        });
      } else {
        await addEntry({
          ...formData,
          date: today,
        });
        showMessage({
          message: 'Success', 
          description: 'Wellness entry saved successfully!',
          type: 'success',
          backgroundColor: theme.colors.success,
          color: theme.colors.backgroundSecondary,
        });
      }
      
      navigation.goBack();
    } catch (error) {
      showMessage({
        message: 'Error',
        description: 'Failed to save wellness entry. Please try again.',
        type: 'danger',
        backgroundColor: theme.colors.error,
        color: theme.colors.backgroundSecondary,
      });
    }
  };

  const getMetricIcon = (label: string) => {
    if (label.includes('Sleep')) return 'S';
    if (label.includes('Exercise')) return 'E';
    if (label.includes('Nutrition')) return 'N';
    if (label.includes('Water')) return 'W';
    if (label.includes('Social')) return 'So';
    if (label.includes('Academic')) return 'A';
    return 'M';
  };

  const renderSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    unit: string,
    onValueChange: (value: number) => void,
    step: number = 1
  ) => {
    return (
      <View style={styles.metricItem}>
        <View style={styles.metricHeader}>
          <View style={styles.metricLabelContainer}>
            <Text style={styles.metricIcon}>{getMetricIcon(label)}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
          </View>
          <Text style={styles.metricValue}>{value} {unit}</Text>
        </View>
        
        <View style={styles.sliderWrapper}>
          <Slider
            style={styles.slider}
            minimumValue={min}
            maximumValue={max}
            value={value}
            onValueChange={onValueChange}
            step={step}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.backgroundTertiary}
            thumbTintColor={theme.colors.primary}
            thumbStyle={styles.sliderThumb}
            trackStyle={styles.sliderTrack}
          />
        </View>
        
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>{min}</Text>
          <Text style={styles.sliderLabelText}>{max}</Text>
        </View>
      </View>
    );
  };

  const getMoodColor = (moodValue: number) => {
    if (moodValue <= 3) return '#ef4444'; // Red for low mood
    if (moodValue <= 5) return '#f97316'; // Orange for okay mood  
    if (moodValue <= 7) return '#eab308'; // Yellow for decent mood
    if (moodValue <= 9) return '#22c55e'; // Green for good mood
    return '#10b981'; // Emerald for amazing mood
  };

  const renderMoodSlider = () => {
    const handleMoodChange = (newMood: number) => {
      setFormData({ ...formData, mood: newMood });
    };
    
    const getMoodDescription = (moodValue: number) => {
      if (moodValue <= 3) return 'Having a tough day';
      if (moodValue <= 5) return 'Okay, could be better';
      if (moodValue <= 7) return 'Pretty good';
      if (moodValue <= 9) return 'Great day';
      return 'Amazing day!';
    };
    
    return (
      <View style={styles.metricItem}>
        <View style={styles.metricHeader}>
          <View style={styles.metricLabelContainer}>
            <Text style={styles.metricIcon}>M</Text>
            <Text style={styles.metricLabel}>How are you feeling today?</Text>
          </View>
          <Text style={[styles.metricValue, { color: getMoodColor(formData.mood) }]}>{formData.mood}/10</Text>
        </View>
        
        <View style={styles.sliderWrapper}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            value={formData.mood}
            onValueChange={handleMoodChange}
            step={1}
            minimumTrackTintColor={getMoodColor(formData.mood)}
            maximumTrackTintColor={theme.colors.backgroundTertiary}
            thumbTintColor={getMoodColor(formData.mood)}
            thumbStyle={[styles.sliderThumb, styles.moodSliderThumb]}
            trackStyle={styles.sliderTrack}
          />
        </View>
        
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>1</Text>
          <Text style={styles.sliderLabelText}>10</Text>
        </View>
        
        <Text style={styles.moodDescription}>
          {getMoodDescription(formData.mood)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Wellness</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.dateSection}>
          <Text style={styles.greeting}>Today</Text>
          <Text style={styles.dateText}>
            {formatDateForDisplay(getTodayDateString())}
          </Text>
          <Text style={styles.subtitle}>Track your daily wellness</Text>
        </View>

        {/* Current Score Preview */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTitle}>Your wellness score</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreValue}>
                {Math.round(
                  (formData.mood * 0.25 +
                   Math.min(formData.sleep / 8, 1) * 10 * 0.20 +
                   Math.min(formData.exercise / 60, 1) * 10 * 0.15 +
                   formData.nutrition * 0.15 +
                   Math.min(formData.water / 8, 1) * 10 * 0.10 +
                   formData.social * 0.10 +
                   formData.academic * 0.05) * 10
                ) / 10}/10
              </Text>
            </View>
          </View>
          <Text style={styles.scoreSubtitle}>
            {isEditing ? 'Update your metrics below to adjust your score' : 'Complete all sections for your wellness score'}
          </Text>
        </View>

        {/* Wellness Metrics */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Wellness Metrics</Text>
          
          {/* Mood */}
          {renderMoodSlider()}

          {/* Sleep */}
          {renderSlider(
            'Hours of Sleep',
            formData.sleep,
            0,
            12,
            'hours',
            (value) => setFormData({ ...formData, sleep: value }),
            0.5
          )}

          {/* Exercise */}
          {renderSlider(
            'Exercise Minutes',
            formData.exercise,
            0,
            120,
            'min',
            (value) => setFormData({ ...formData, exercise: value }),
            5
          )}

          {/* Nutrition */}
          {renderSlider(
            'Nutrition Quality',
            formData.nutrition,
            1,
            10,
            '/10',
            (value) => setFormData({ ...formData, nutrition: value })
          )}

          {/* Water */}
          {renderSlider(
            'Water Intake',
            formData.water,
            0,
            12,
            'glasses',
            (value) => setFormData({ ...formData, water: value })
          )}

          {/* Social */}
          {renderSlider(
            'Social Connection',
            formData.social,
            1,
            10,
            '/10',
            (value) => setFormData({ ...formData, social: value })
          )}

          {/* Academic */}
          {renderSlider(
            'Academic Progress',
            formData.academic,
            1,
            10,
            '/10',
            (value) => setFormData({ ...formData, academic: value })
          )}
        </View>

        {/* Notes Section */}
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <Text style={styles.notesSubtitle}>How was your day? Any highlights or challenges? (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            placeholder="Write about your day..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 15,
    backgroundColor: theme.colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: theme.colors.backgroundSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  
  // Header Section
  dateSection: {
    paddingVertical: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  
  // Score Section 
  scoreSection: {
    backgroundColor: theme.colors.backgroundCard,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  scoreBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.backgroundSecondary,
  },
  scoreSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  
  // Metrics Section
  metricsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  metricItem: {
    backgroundColor: theme.colors.backgroundCard,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: theme.colors.backgroundSecondary,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  sliderWrapper: {
    marginVertical: 16,
    marginHorizontal: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: theme.colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  moodSliderThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  moodDescription: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
  },
  
  // Notes Section
  notesSection: {
    marginBottom: 20,
  },
  notesSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: theme.colors.backgroundSecondary,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  
  bottomPadding: {
    height: 40,
  },
});

export default WellnessLogScreen; 