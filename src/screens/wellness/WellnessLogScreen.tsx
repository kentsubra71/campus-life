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
        backgroundColor: '#1f2937',
        color: '#f9fafb',
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
        backgroundColor: '#1f2937',
        color: '#f9fafb',
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
      <View style={styles.sliderContainer}>
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
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#374151"
            thumbTintColor="#ffffff"
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
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>How are you feeling today?</Text>
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
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#374151"
            thumbTintColor="#ffffff"
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

        {/* Notes */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            placeholder="How was your day? Any highlights or challenges?"
            placeholderTextColor="#9ca3af"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: 'theme.colors.primary',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
  },
  saveButton: {
    backgroundColor: 'theme.colors.primary',
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
    color: '#9ca3af',
    fontWeight: '500',
  },
  sliderContainer: {
    marginBottom: 30,
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#f9fafb',
    flex: 1,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: 'theme.colors.primary',
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
    backgroundColor: 'theme.colors.primary',
    width: 24,
    height: 24,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  moodDescription: {
    marginTop: 10,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  notesContainer: {
    marginBottom: 30,
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: '#374151',
    color: '#f9fafb',
  },
  previewContainer: {
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 30,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 10,
  },
  previewScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
  },
});

export default WellnessLogScreen; 