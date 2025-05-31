import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, BackHandler, Alert, TextInput, RefreshControl, Platform, Vibration, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Course, getCourses } from '../lib/api';
import QRCode from 'react-native-qrcode-svg';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { API_CONFIG } from '../config';

const { width } = Dimensions.get('window');

// Function to get current Philippine time
const getPhilippineTime = () => {
  const now = new Date();
  // Get the current UTC time
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Convert to Philippine time (UTC+8)
  const phTime = new Date(utcTime + (8 * 60 * 60 * 1000));

  // Format the time to ensure accuracy
  const hours = phTime.getHours().toString().padStart(2, '0');
  const minutes = phTime.getMinutes().toString().padStart(2, '0');
  const seconds = phTime.getSeconds().toString().padStart(2, '0');

  // Create a new date with the exact Philippine time
  const exactPhTime = new Date(phTime.getFullYear(), phTime.getMonth(), phTime.getDate(),
    parseInt(hours), parseInt(minutes), parseInt(seconds));

  return exactPhTime;
};

// Function to format time in Philippine timezone
const formatPhilippineTime = (timestamp: string) => {
  try {
    // Parse the ISO string timestamp directly
    const date = new Date(timestamp);
    
    // Extract time directly from the timestamp without adding 8 hours
    const match = timestamp.match(/T(\d{2}):(\d{2})/);
    if (match) {
      const hours24 = parseInt(match[1], 10);
      const minutes = match[2];
      
      // Convert to 12-hour format
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      
      // Return formatted string - display the database time directly
      return `${hours12}:${minutes} ${ampm}`;
    }
    
    // Fallback if regex fails
    const hours = date.getUTCHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    return `${hours12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// Function to format date from database timestamp
const formatPhilippineDate = (timestamp: string) => {
  try {
    // Parse the ISO string timestamp directly
    const date = new Date(timestamp);
    
    // Extract date directly from the timestamp without timezone adjustment
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Months are 0-based in JS
      const day = parseInt(match[3], 10);
      
      // Create a Date object with these values to get day of week
      const dateObj = new Date(year, month, day);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
      
      // Get month name
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
      
      // Return formatted string
      return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
    }
    
    // Fallback if regex fails
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    
    return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// Function to format date and time for session tabs
const formatSessionTabTime = (timestamp: string) => {
  try {
    // Extract date and time directly from the timestamp without timezone adjustment
    const dateMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = timestamp.match(/T(\d{2}):(\d{2})/);
    
    if (dateMatch && timeMatch) {
      // Parse date components
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // Months are 0-based in JS
      const day = parseInt(dateMatch[3], 10);
      
      // Parse time components
      const hours24 = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      
      // Convert to 12-hour format
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      
      // Get abbreviated month name
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Return formatted string - display the database time directly
      return `${months[month]} ${day}, ${hours12}:${minutes} ${ampm}`;
    }
    
    // Fallback if regex fails - use direct UTC methods
    const date = new Date(timestamp);
    
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    // Format time for display
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    
    // Get abbreviated month name
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${months[month]} ${day}, ${hours12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting session tab time:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// WebSocket connection setup
const setupWebSocket = (courseId: string, onNewScan: () => void) => {
  const wsUrl = API_CONFIG.baseURL.replace('http', 'ws');
  const ws = new WebSocket(`${wsUrl}/attendance/${courseId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'new_scan') {
      onNewScan();
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
};

SplashScreen.preventAutoHideAsync();

export default function LecturerDashboard() {
  const params = useLocalSearchParams();
  const currentUserId = params.id as string;

  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      fetchAssignedCourses();
    }
  }, [currentUserId]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogoutConfirm(true);
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  const fetchAssignedCourses = async () => {
    try {
      setIsLoading(true);
      const allCourses = await getCourses();
      console.log('Current Lecturer ID:', currentUserId);
      console.log('All Courses:', allCourses);

      const assignedCourses = allCourses.filter((course: Course) => {
        console.log('Course Lecturer ID:', course.lecturerId?._id);
        return course.lecturerId?._id === currentUserId;
      });

      console.log('Assigned Courses:', assignedCourses);
      setCourses(assignedCourses);
      setError(null);
    } catch (error) {
      console.error('Error fetching assigned courses:', error);
      setError('Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    router.replace('/');
  };

  const handleRefresh = () => {
    fetchAssignedCourses();
  };

  const generateQRData = (course: Course) => {
    const phTime = getPhilippineTime();
    const expiryTime = new Date(phTime.getTime() + (60 * 60 * 1000)); // 1 hour from now

    return JSON.stringify({
      courseId: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      generatedAt: phTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    });
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundPattern}>
        <View style={styles.patternCircle1} />
        <View style={styles.patternCircle2} />
        <View style={styles.patternCircle3} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.logoTitle}>ATTENDANCE</Text>
              <Text style={styles.logoSubtitle}>Lecturer Dashboard</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={32} color="#1a4b8e" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            colors={['#1a4b8e']}
            tintColor="#1a4b8e"
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#1a4b8e" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No assigned courses found</Text>
          </View>
        ) : (
          courses.map((course) => (
            <CourseCard key={course._id} course={course} />
          ))
        )}
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <Ionicons name="log-out-outline" size={48} color="#1a4b8e" />
              <Text style={styles.confirmTitle}>Confirm Logout</Text>
            </View>

            <Text style={styles.confirmText}>
              Are you sure you want to logout?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.logoutConfirmButton]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CourseCard = ({ course }: { course: Course }) => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [qrData, setQRData] = useState<{ data: string; expiresAt: string } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [newScans, setNewScans] = useState(0);
  const qrRef = useRef<any>(null);
  const countdownInterval = useRef<NodeJS.Timeout>();
  const wsRef = useRef<WebSocket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lastCheckTime = useRef<Date>(new Date());

  // Setup WebSocket connection
  useEffect(() => {
    const handleNewScan = async () => {
      try {
        const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
        if (!response.ok) return;

        const records = await response.json();
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        // Count scans in the last 5 minutes
        const recentScans = records.reduce((count: number, record: any) => {
          const recordTime = new Date(record.generatedAt);
          const timeDiff = phTime.getTime() - recordTime.getTime();
          if (timeDiff <= 5 * 60 * 1000) { // 5 minutes
            return count + record.scannedBy.length;
          }
          return count;
        }, 0);

        setNewScans(recentScans);
      } catch (error) {
        console.error('Error checking new scans:', error);
      }
    };

    // Initialize WebSocket connection
    wsRef.current = setupWebSocket(course._id, handleNewScan);

    // Cleanup WebSocket connection
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [course._id]);

  // Check for existing valid QR code
  const checkExistingQRCode = async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const records = await response.json();

      // Find the most recent valid QR code
      const now = new Date();
      const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
      const validRecord = records.find((record: any) => new Date(record.expiresAt) > phTime);

      if (validRecord) {
        setQRData({
          data: validRecord.qrCodeData,
          expiresAt: validRecord.expiresAt
        });
        setShowQRModal(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking existing QR code:', error);
      return false;
    }
  };

  useEffect(() => {
    if (qrData) {
      // Start countdown timer
      countdownInterval.current = setInterval(() => {
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
        const expiryTime = new Date(qrData.expiresAt);
        const diffInMinutes = Math.floor((expiryTime.getTime() - phTime.getTime()) / (1000 * 60));

        if (diffInMinutes <= 0) {
          setRemainingTime('expired');
          clearInterval(countdownInterval.current);
          setShowQRModal(false);
          setQRData(null);
        } else {
          setRemainingTime(`${diffInMinutes} minutes`);
        }
      }, 1000);
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [qrData]);

  const generateQRData = async () => {
    try {
      setIsLoading(true);
      if (!course.lecturerId?._id) {
        throw new Error('Lecturer ID not found');
      }

      const response = await fetch(`${API_CONFIG.baseURL}/attendance/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course._id,
          lecturerId: course.lecturerId._id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const data = await response.json();
      return {
        data: data.qrData,
        expiresAt: data.expiresAt
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    const hasValidQR = await checkExistingQRCode();
    if (!hasValidQR) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmGenerateQR = async () => {
    setShowConfirmModal(false);
    const newQRData = await generateQRData();
    if (newQRData) {
      setQRData(newQRData);
      setShowQRModal(true);
    }
  };

  // Check for new scans
  useEffect(() => {
    const checkNewScans = async () => {
      try {
        const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
        if (!response.ok) return;

        const records = await response.json();
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        // Get the most recent record
        const mostRecentRecord = records.sort((a: any, b: any) =>
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
        )[0];

        if (mostRecentRecord) {
          const recordTime = new Date(mostRecentRecord.generatedAt);
          const timeDiff = phTime.getTime() - recordTime.getTime();

          // If the record is from the last 5 minutes
          if (timeDiff <= 5 * 60 * 1000) {
            const scanCount = mostRecentRecord.scannedBy.length;
            if (scanCount > newScans) {
              setNewScans(scanCount);
              // Vibrate or play sound to notify
              if (Platform.OS === 'android') {
                Vibration.vibrate(500);
              }
            }
          } else {
            setNewScans(0);
          }
        }

        lastCheckTime.current = now;
      } catch (error) {
        console.error('Error checking new scans:', error);
      }
    };

    // Check every 3 seconds
    const interval = setInterval(checkNewScans, 3000);
    return () => clearInterval(interval);
  }, [course._id]);

  // Reset new scans count when viewing attendance
  const handleViewAttendance = async () => {
    setNewScans(0);
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const records = await response.json();

      // Sort records by generation time (most recent first)
      const sortedRecords = records.sort((a: any, b: any) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );

      setAttendanceRecords(sortedRecords);
      setShowAttendanceModal(true);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      Alert.alert('Error', 'Failed to fetch attendance records. Please try again.');
    }
  };

  const handleSaveQRCode = async () => {
    try {
      // Request permission to access media library
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant permission to save QR code to your gallery.');
        return;
      }

      if (qrRef.current) {
        const uri = await qrRef.current.capture();
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('CHEQR', asset, false);

        Alert.alert('Success', 'QR code saved to gallery successfully!');
      }
    } catch (error) {
      console.error('Error saving QR code:', error);
      Alert.alert('Error', 'Failed to save QR code to gallery.');
    }
  };

  const filteredRecords = attendanceRecords.map(record => {
    const filteredScans = record.scannedBy.filter((scan: any) => {
      const fullName = `${scan.studentId.firstName} ${scan.studentId.lastName}`.toLowerCase();
      const idNumber = scan.studentId.idNumber.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || idNumber.includes(query);
    });
    return { ...record, scannedBy: filteredScans };
  }).filter(record => record.scannedBy.length > 0);

  const handleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <View style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <View style={styles.courseTitleSection}>
          <Text style={styles.courseCode}>{course.courseCode}</Text>
          <Text style={styles.courseTitle} numberOfLines={1}>{course.courseName}</Text>
        </View>
        <View style={styles.courseActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.qrButton]}
            onPress={handleGenerateQR}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#1a73e8" />
            ) : (
              <Ionicons name="qr-code-outline" size={20} color="#1a73e8" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.attendanceButton]}
            onPress={handleViewAttendance}
          >
            <View>
              <Ionicons name="people-outline" size={20} color="#34C759" />
              {newScans > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationText}>{newScans}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.courseInfo}>
        <View style={styles.instructorSection}>
          <Ionicons name="person-circle-outline" size={20} color="#666" />
          <Text style={styles.instructorText}>
            {course.lecturerId ? `${course.lecturerId.firstName} ${course.lecturerId.lastName}` : 'Not assigned'}
          </Text>
        </View>

        <View style={styles.schedulesContainer}>
          {course.schedules.map((schedule, scheduleIndex) => (
            <View 
              key={scheduleIndex} 
              style={styles.scheduleItem}
            >
              <View style={styles.scheduleTime}>
                <Ionicons name="time-outline" size={16} color="#1a73e8" />
                <Text style={styles.timeText}>{schedule.startTime} - {schedule.endTime}</Text>
              </View>
              <View style={styles.scheduleDays}>
                {schedule.days.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.dayPill}>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* QR Code Generation Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <Ionicons name="qr-code-outline" size={48} color="#002147" />
              <Text style={styles.confirmTitle}>Generate QR Code</Text>
            </View>

            <Text style={styles.confirmText}>
              This will generate a QR code for attendance that will expire in 1 hour. Are you sure you want to proceed?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmGenerateButton]}
                onPress={handleConfirmGenerateQR}
              >
                <Text style={styles.confirmGenerateText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.qrModalContent]}>
            <View style={styles.qrModalHeader}>
              <View style={styles.qrModalTitleContainer}>
                <Text style={styles.qrModalTitle}>Attendance QR Code</Text>
                <Text style={styles.qrModalSubtitle}>{course.courseCode} - {course.courseName}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowQRModal(false)}
                style={styles.qrCloseButton}
              >
                <Ionicons name="close" size={24} color="#002147" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrContentContainer}>
              <View style={styles.qrWrapper}>
                <ViewShot ref={qrRef} style={styles.qrContainer}>
                  {qrData && (
                    <QRCode
                      value={qrData.data}
                      size={220}
                      color="#002147"
                      backgroundColor="white"
                    />
                  )}
                </ViewShot>
                <View style={styles.qrTimerContainer}>
                  <Ionicons name="time-outline" size={20} color="#1a73e8" />
                  <Text style={styles.qrTimerText}>
                    Expires in {remainingTime} {qrData && qrData.expiresAt ? `(${formatPhilippineTime(qrData.expiresAt)})` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.qrInfoContainer}>
                <View style={styles.qrInfoItem}>
                  <Ionicons name="calendar-outline" size={20} color="#6200ee" />
                  <Text style={styles.qrInfoText}>
                    {qrData ? formatPhilippineDate(qrData.data ? JSON.parse(qrData.data).generatedAt : new Date().toISOString()) : formatPhilippineDate(new Date().toISOString())}
                  </Text>
                </View>
                <View style={styles.qrInfoItem}>
                  <Ionicons name="time-outline" size={20} color="#1a73e8" />
                  <Text style={styles.qrInfoText}>
                    {qrData ? formatPhilippineTime(qrData.data ? JSON.parse(qrData.data).generatedAt : new Date().toISOString()) : formatPhilippineTime(new Date().toISOString())}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveQRButton}
                onPress={handleSaveQRCode}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.saveQRButtonText}>Save QR Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attendance Modal */}
      <Modal
        visible={showAttendanceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAttendanceModal(false)}
      >
        <View style={[styles.modalOverlay, isFullScreen && styles.fullScreenModal]}>
          <View style={[styles.modalContent, isFullScreen && styles.fullScreenContent, styles.attendanceModalContent]}>
            <View style={styles.attendanceHeader}>
              <View style={styles.attendanceHeaderContent}>
                <View style={styles.attendanceTitleSection}>
                  <Text style={styles.attendanceTitle}>Attendance Records</Text>
                  <Text style={styles.attendanceSubtitle}>{course.courseCode} - {course.courseName}</Text>
                </View>
                <View style={styles.attendanceActions}>
                  <TouchableOpacity 
                    onPress={handleFullScreen} 
                    style={styles.attendanceActionButton}
                  >
                    <Ionicons
                      name={isFullScreen ? "contract-outline" : "expand-outline"}
                      size={24}
                      color="#6200ee"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setShowAttendanceModal(false)}
                    style={styles.attendanceActionButton}
                  >
                    <Ionicons name="close" size={24} color="#002147" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search students..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#999"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={styles.clearSearchButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.sessionTabsContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sessionTabsScroll}
              >
                <TouchableOpacity
                  style={[styles.sessionTab, !selectedSession && styles.selectedSessionTab]}
                  onPress={() => setSelectedSession(null)}
                >
                  <Ionicons 
                    name="calendar-outline" 
                    size={16} 
                    color={!selectedSession ? "#fff" : "#666"} 
                  />
                  <Text style={[styles.sessionTabText, !selectedSession && styles.selectedSessionTabText]}>
                    All Sessions
                  </Text>
                </TouchableOpacity>
                {attendanceRecords.map((record, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.sessionTab, selectedSession === record._id && styles.selectedSessionTab]}
                    onPress={() => setSelectedSession(record._id)}
                  >
                    <Ionicons 
                      name="time-outline" 
                      size={16} 
                      color={selectedSession === record._id ? "#fff" : "#666"} 
                    />
                                      <Text style={[styles.sessionTabText, selectedSession === record._id && styles.selectedSessionTabText]}>
                    {formatSessionTabTime(record.generatedAt)}
                  </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.attendanceList}>
              {filteredRecords.length === 0 ? (
                <View style={styles.emptyAttendanceState}>
                  <Ionicons name="people-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyAttendanceText}>
                    {searchQuery ? 'No matching students found' : 'No attendance records found'}
                  </Text>
                </View>
              ) : (
                filteredRecords
                  .filter(record => !selectedSession || record._id === selectedSession)
                  .map((record, index) => (
                    <View key={index} style={styles.attendanceSession}>
                      <View style={styles.sessionHeader}>
                        <View style={styles.sessionInfo}>
                          <Text style={styles.sessionDate}>
                            {formatPhilippineDate(record.generatedAt)}
                          </Text>
                          <Text style={styles.sessionTime}>
                            {formatPhilippineTime(record.generatedAt)}
                          </Text>
                        </View>
                        <View style={styles.sessionStats}>
                          <View style={styles.statItem}>
                            <Ionicons name="people-outline" size={16} color="#6200ee" />
                            <Text style={styles.statText}>{record.scannedBy.length} Students</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.studentsList}>
                        {record.scannedBy.map((scan: any, scanIndex: number) => (
                                                    <View key={scanIndex} style={styles.studentInfo}>
                              <View style={styles.studentAvatar}>
                                <Text style={styles.avatarText}>
                                  {scan.studentId.firstName[0]}{scan.studentId.lastName[0]}
                                </Text>
                              </View>
                              <View style={styles.studentDetails}>
                                <Text style={styles.studentName}>
                                  {scan.studentId.firstName} {scan.studentId.lastName}
                                </Text>
                                <Text style={styles.studentId}>
                                  ID: {scan.studentId.idNumber}
                                </Text>
                                <Text style={styles.scanTime}>
                                  Scanned at: {formatPhilippineTime(scan.scannedAt)}
                                </Text>
                              </View>
                            </View>
                        ))}
                      </View>
                    </View>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6200ee',
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle1: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  patternCircle2: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -width * 0.1,
    left: -width * 0.1,
  },
  patternCircle3: {
    position: 'absolute',
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: '30%',
    left: '20%',
  },
  header: {
    backgroundColor: 'transparent',
    padding: 20,
    paddingTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    marginRight: 12,
    transform: [{ rotate: '10deg' }],
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  headerTitleContainer: {
    flexDirection: 'column',
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  logoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  courseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  courseTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  courseCode: {
    fontSize: 14,
    color: '#6200ee',
    fontWeight: '600',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3c4043',
    lineHeight: 22,
  },
  courseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  qrButton: {
    backgroundColor: '#f3e5ff',
    borderColor: '#6200ee',
  },
  attendanceButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  courseInfo: {
    gap: 12,
  },
  instructorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  instructorText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  schedulesContainer: {
    gap: 8,
  },
  scheduleItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#6200ee',
    marginLeft: 8,
    fontWeight: '600',
  },
  scheduleDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayPill: {
    backgroundColor: '#f3e5ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayText: {
    fontSize: 12,
    color: '#6200ee',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
  },
  confirmModal: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6200ee',
    marginTop: 8,
  },
  confirmText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelConfirmButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutConfirmButton: {
    backgroundColor: '#6200ee',
  },
  cancelConfirmText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrModalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  qrModalTitleContainer: {
    flex: 1,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  qrModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  qrCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrContentContainer: {
    padding: 24,
  },
  qrWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  qrTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e5ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  qrTimerText: {
    fontSize: 14,
    color: '#6200ee',
    fontWeight: '600',
  },
  qrInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  qrInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrInfoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  saveQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200ee',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveQRButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  courseSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fullScreenButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 8,
  },
  sessionTabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sessionTabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  sessionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    gap: 8,
    marginRight: 8,
  },
  selectedSessionTab: {
    backgroundColor: '#6200ee',
  },
  sessionTabText: {
    fontSize: 14,
    color: '#666',
  },
  selectedSessionTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  attendanceList: {
    flex: 1,
    padding: 16,
  },
  emptyAttendanceState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyAttendanceText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  attendanceSession: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6200ee',
  },
  sessionTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: {
    fontSize: 14,
    color: '#6200ee',
    fontWeight: '500',
  },
  studentsList: {
    padding: 16,
    gap: 12,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3e5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3c4043',
  },
  studentId: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  scanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scanTime: {
    fontSize: 12,
    color: '#6200ee',
    marginTop: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confirmGenerateButton: {
    backgroundColor: '#6200ee',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmGenerateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  attendanceModalContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    padding: 0,
    backgroundColor: '#f8f9fa',
  },
  attendanceHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 16,
  },
  attendanceHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceTitleSection: {
    flex: 1,
  },
  attendanceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  attendanceSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  attendanceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fullScreenModal: {
    backgroundColor: '#fff',
  },
  fullScreenContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    padding: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#002147',
  },
}); 