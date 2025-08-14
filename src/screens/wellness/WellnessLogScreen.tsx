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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { showMessage } from 'react-native-flash-message';
import { useWellnessStore, WellnessEntry } from '../../stores/wellnessStore';

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
    const today = new Date().toISOString().split('T')[0];
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

  const handleSave = () => {
    const today = new Date().toISOString().split('T')[0];
    
    if (isEditing && todayEntry) {
      updateEntry(todayEntry.id, {
        ...formData,
        date: today,
      });
      showMessage({
        message: 'Success',
        description: 'Wellness entry updated successfully!',
        type: 'success',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.textPrimary,
      });
    } else {
      addEntry({
        ...formData,
        date: today,
      });
      showMessage({
        message: 'Success', 
        description: 'Wellness entry saved successfully!',
        type: 'success',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.textPrimary,
      });
    }
    
    navigation.goBack();
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
      <View style={styles.sliderItem}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>{label}</Text>
          <Text style={styles.sliderValue}>{value} {unit}</Text>
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
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.primary}
          />
        </View>
        
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>{min}</Text>
          <Text style={styles.sliderLabelText}>{max}</Text>
        </View>
      </View>
    );
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
      return 'Amazing day';
    };
    
    return (
      <View style={styles.sliderItem}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Overall Mood</Text>
          <Text style={styles.sliderValue}>{formData.mood}/10</Text>
        </View>
        
        <View style={styles.sliderWrapper}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            value={formData.mood}
            onValueChange={handleMoodChange}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.primary}
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

  const getWellnessScore = () => {
    return Math.round(
      (formData.mood * 0.25 +
       Math.min(formData.sleep / 8, 1) * 10 * 0.20 +
       Math.min(formData.exercise / 60, 1) * 10 * 0.15 +
       formData.nutrition * 0.15 +
       Math.min(formData.water / 8, 1) * 10 * 0.10 +
       formData.social * 0.10 +
       formData.academic * 0.05) * 10
    ) / 10;
  };

  const getScoreTag = () => {
    const score = getWellnessScore();
    if (score >= 8) return { text: 'Great', color: theme.colors.success };
    if (score >= 6) return { text: 'Good', color: theme.colors.warning };
    return { text: 'Needs Care', color: theme.colors.error };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Wellness Log</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Date Header */}
          <View style={styles.dateSection}>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            {isEditing && (
              <View style={styles.editingTag}>
                <Text style={styles.editingTagText}>Editing</Text>
              </View>
            )}
          </View>

          {/* Wellness Score Preview */}
          <View style={styles.scoreSection}>
            <View style={styles.scoreHeader}>
              <Text style={styles.sectionTitle}>Today's Wellness Score</Text>
              <View style={[styles.scoreTag, { backgroundColor: getScoreTag().color }]}>
                <Text style={styles.scoreTagText}>{getScoreTag().text}</Text>
              </View>
            </View>
            <Text style={styles.scoreValue}>{getWellnessScore()}/10</Text>
          </View>

          {/* Wellness Metrics */}
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>How are you feeling?</Text>
            {renderMoodSlider()}
          </View>

          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Physical Health</Text>
            {renderSlider(
              'Hours of Sleep',
              formData.sleep,
              0,
              12,
              'hours',
              (value) => setFormData({ ...formData, sleep: value }),
              0.5
            )}
            {renderSlider(
              'Exercise Minutes',
              formData.exercise,
              0,
              120,
              'min',
              (value) => setFormData({ ...formData, exercise: value }),
              5
            )}
            {renderSlider(
              'Water Intake',
              formData.water,
              0,
              12,
              'glasses',
              (value) => setFormData({ ...formData, water: value })
            )}
          </View>

          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Daily Life</Text>
            {renderSlider(
              'Nutrition Quality',
              formData.nutrition,
              1,
              10,
              '/10',
              (value) => setFormData({ ...formData, nutrition: value })
            )}
            {renderSlider(
              'Social Connection',
              formData.social,
              1,
              10,
              '/10',
              (value) => setFormData({ ...formData, social: value })
            )}
            {renderSlider(
              'Academic Progress',
              formData.academic,
              1,
              10,
              '/10',
              (value) => setFormData({ ...formData, academic: value })
            )}
          </View>

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.notesSubtitle}>How was your day? Any highlights or challenges?</Text>
            <TextInput
              style={styles.notesInput}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              placeholder="Optional notes about your day..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 15,
    paddingTop: 60,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Date Section
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  editingTag: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editingTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Score Section
  scoreSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },

  // Sections
  metricsSection: {
    marginBottom: 24,
  },
  notesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  notesSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },

  // Slider Items - Clean layout without cards
  sliderItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  sliderWrapper: {
    marginVertical: 12,
    marginHorizontal: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: '500',
  },
  moodDescription: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Notes Input
  notesInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
});

export default WellnessLogScreen; 