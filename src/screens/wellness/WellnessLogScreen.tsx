import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWellnessStore, WellnessEntry } from '../../stores/wellnessStore';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../constants/themes';

interface WellnessLogScreenProps {
  navigation: any;
}

const WellnessLogScreen: React.FC<WellnessLogScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
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
      Alert.alert('Success', 'Wellness entry updated successfully!');
    } else {
      addEntry({
        ...formData,
        date: today,
      });
      Alert.alert('Success', 'Wellness entry saved successfully!');
    }
    
    navigation.goBack();
  };

  const renderSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    unit: string,
    onValueChange: (value: number) => void
  ) => {
    const styles = createStyles(theme);
    const handleValueChange = (newValue: number) => {
      console.log(`${label}: ${value} -> ${newValue}`);
      onValueChange(newValue);
    };
    
    return (
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>{label}</Text>
          <Text style={styles.sliderValue}>{value} {unit}</Text>
        </View>
        
        {/* Large touch buttons */}
        <View style={styles.sliderButtonsContainer}>
          {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((stepValue) => (
            <TouchableOpacity
              key={stepValue}
              style={[
                styles.sliderButton,
                stepValue <= value && styles.sliderButtonActive,
              ]}
              onPress={() => handleValueChange(stepValue)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.sliderButtonText,
                stepValue <= value && styles.sliderButtonTextActive
              ]}>
                {stepValue}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${((value - min) / (max - min)) * 100}%` }
              ]} 
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{min}</Text>
            <Text style={styles.progressLabel}>{max}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMoodSlider = () => {
    const styles = createStyles(theme);
    const handleMoodChange = (newMood: number) => {
      console.log(`Mood: ${formData.mood} -> ${newMood}`);
      setFormData({ ...formData, mood: newMood });
    };
    
    const getMoodEmoji = (moodValue: number) => {
      if (moodValue <= 2) return '😢';
      if (moodValue <= 4) return '😐';
      if (moodValue <= 6) return '🙂';
      if (moodValue <= 8) return '😊';
      return '🤩';
    };
    
    return (
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>How are you feeling today?</Text>
          <Text style={styles.sliderValue}>{formData.mood}/10</Text>
        </View>
        
        {/* Large mood buttons */}
        <View style={styles.sliderButtonsContainer}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((moodValue) => (
            <TouchableOpacity
              key={moodValue}
              style={[
                styles.sliderButton,
                moodValue <= formData.mood && styles.sliderButtonActive,
              ]}
              onPress={() => handleMoodChange(moodValue)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.sliderButtonText,
                moodValue <= formData.mood && styles.sliderButtonTextActive
              ]}>
                {getMoodEmoji(moodValue)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${((formData.mood - 1) / 9) * 100}%` }
              ]} 
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>😢</Text>
            <Text style={styles.progressLabel}>🤩</Text>
          </View>
        </View>
        
        <Text style={styles.moodDescription}>
          {formData.mood <= 3 ? '😢 Having a tough day' :
           formData.mood <= 5 ? '😐 Okay, could be better' :
           formData.mood <= 7 ? '🙂 Pretty good!' :
           formData.mood <= 9 ? '😊 Great day!' : '🤩 Amazing day!'}
        </Text>
      </View>
    );
  };

  const styles = createStyles(theme);
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Wellness Log</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>

        {/* Mood */}
        {renderMoodSlider()}

        {/* Sleep */}
        {renderSlider(
          'Hours of Sleep',
          formData.sleep,
          0,
          12,
          'hours',
          (value) => setFormData({ ...formData, sleep: value })
        )}

        {/* Exercise */}
        {renderSlider(
          'Exercise Minutes',
          formData.exercise,
          0,
          120,
          'min',
          (value) => setFormData({ ...formData, exercise: value })
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

        {/* Notes */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            placeholder="How was your day? Any highlights or challenges?"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Today's Wellness Score</Text>
          <Text style={styles.previewScore}>
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
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.card,
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
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dateContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  sliderContainer: {
    marginBottom: 30,
    backgroundColor: theme.colors.card,
    padding: 20,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  sliderButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sliderButton: {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  sliderButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  sliderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  sliderButtonTextActive: {
    color: '#fff',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  moodDescription: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  notesContainer: {
    marginBottom: 30,
    backgroundColor: theme.colors.card,
    padding: 20,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
  previewContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: 20,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 30,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 10,
  },
  previewScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
});

export default WellnessLogScreen; 