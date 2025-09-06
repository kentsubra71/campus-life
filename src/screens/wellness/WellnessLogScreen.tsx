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
  const { addEntry, updateEntry, getEntryByDate, todayEntry, loadEntries } = useWellnessStore();
  const [formData, setFormData] = useState({
    rankings: {
      sleep: 1,      // Best performing (rank 1)
      nutrition: 2,  // Second best (rank 2) 
      academics: 3,  // Third best (rank 3)
      social: 4,     // Worst performing (rank 4)
    },
    overallMood: 5, // 1-10 mood slider
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      // Load entries first to ensure they're available
      await loadEntries();
      
      const today = getTodayDateString();
      const existingEntry = getEntryByDate(today);
      
      if (existingEntry) {
        setFormData({
          rankings: {
            sleep: existingEntry.rankings.sleep,
            nutrition: existingEntry.rankings.nutrition,
            academics: existingEntry.rankings.academics,
            social: existingEntry.rankings.social,
          },
          overallMood: existingEntry.overallMood,
        });
        
        // Reorder categories based on existing rankings
        const categoryMap = {
          sleep: { key: 'sleep', title: 'Sleep' },
          nutrition: { key: 'nutrition', title: 'Nutrition' },
          academics: { key: 'academics', title: 'Academics' },
          social: { key: 'social', title: 'Social' },
        };
        
        const sortedCategories = Object.entries(existingEntry.rankings)
          .sort(([,a], [,b]) => a - b) // Sort by ranking (1=best, 4=worst)
          .map(([key]) => categoryMap[key as keyof typeof categoryMap]);
          
        setOrderedCategories(sortedCategories);
        setIsEditing(true);
      }
    };

    initializeData();
  }, [loadEntries, getEntryByDate]);

  const handleSave = async () => {
    const today = getTodayDateString();
    
    console.log('💾 Saving wellness entry:', { 
      formData, 
      rankings: formData.rankings,
      overallMood: formData.overallMood,
      isEditing, 
      todayEntry 
    });
    
    try {
      if (isEditing && todayEntry) {
        console.log('🔄 Updating existing entry:', todayEntry.id);
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
        console.log('➕ Adding new entry');
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
      
      // Use canGoBack() to check if we can go back, otherwise navigate to Dashboard
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Dashboard');
      }
    } catch (error) {
      console.error('❌ Failed to save wellness entry:', error);
      showMessage({
        message: 'Error',
        description: 'Failed to save wellness entry. Please try again.',
        type: 'danger',
        backgroundColor: theme.colors.error,
        color: theme.colors.backgroundSecondary,
      });
    }
  };

  // Simple ordering system
  const [orderedCategories, setOrderedCategories] = useState([
    { key: 'sleep', title: 'Sleep' },
    { key: 'nutrition', title: 'Nutrition' },
    { key: 'academics', title: 'Academics' },
    { key: 'social', title: 'Social' },
  ]);

  const moveCategory = (fromIndex: number, toIndex: number) => {
    const newOrder = [...orderedCategories];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setOrderedCategories(newOrder);
    
    // Update rankings based on new order
    const newRankings = { ...formData.rankings };
    newOrder.forEach((category, index) => {
      newRankings[category.key as keyof typeof newRankings] = index + 1;
    });
    
    setFormData({
      ...formData,
      rankings: newRankings
    });
  };

  const getMoodDescription = (mood: number) => {
    if (mood <= 2) return 'Really tough day';
    if (mood <= 4) return 'Challenging day';
    if (mood <= 6) return 'Okay day';
    if (mood <= 8) return 'Pretty good day';
    return 'Great day!';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Dashboard');
          }
        }} style={styles.backButton}>
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

        {/* Overall Mood */}
        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>How was your day overall?</Text>
          <View style={styles.moodSliderContainer}>
            <Slider
              style={styles.moodSlider}
              minimumValue={1}
              maximumValue={10}
              value={formData.overallMood}
              onValueChange={(value) => setFormData({ ...formData, overallMood: Math.round(value) })}
              step={1}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.backgroundTertiary}
              thumbTintColor={theme.colors.primary}
            />
            <View style={styles.moodFeedback}>
              <Text style={styles.moodValue}>{formData.overallMood}/10</Text>
              <Text style={styles.moodDescription}>{getMoodDescription(formData.overallMood)}</Text>
            </View>
          </View>
        </View>

        {/* Simple Category Ordering */}
        <View style={styles.orderingSection}>
          <Text style={styles.sectionTitle}>Order these areas</Text>
          <Text style={styles.instructionText}>From best performing to worst performing today</Text>
          
          {orderedCategories.map((category, index) => (
            <TouchableOpacity key={category.key} style={styles.categoryItem}>
              <View style={styles.categoryContent}>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryPosition}>#{index + 1}</Text>
              </View>
              <View style={styles.moveButtons}>
                <TouchableOpacity 
                  style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                  onPress={() => moveCategory(index, index - 1)}
                  disabled={index === 0}
                >
                  <Text style={styles.moveButtonText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.moveButton, index === orderedCategories.length - 1 && styles.moveButtonDisabled]}
                  onPress={() => moveCategory(index, index + 1)}
                  disabled={index === orderedCategories.length - 1}
                >
                  <Text style={styles.moveButtonText}>↓</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
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
  
  // Mood Section
  moodSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  moodSliderContainer: {
    paddingHorizontal: 8,
  },
  moodSlider: {
    width: '100%',
    height: 40,
  },
  moodFeedback: {
    alignItems: 'center',
    marginTop: 12,
  },
  moodValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  moodDescription: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  
  // Ordering Section
  orderingSection: {
    marginBottom: 30,
  },
  instructionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  
  // Category Item (clean dashboard style)
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  categoryPosition: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  
  // Move Buttons (minimal)
  moveButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 16,
  },
  moveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  moveButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textTertiary,
  },
  
  // Score Section (simplified)
  scoreSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  scoreLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.primary,
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