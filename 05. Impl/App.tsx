import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.flexGrow}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Svg width={220} height={180} viewBox="0 0 220 180">
            {/* Triangular shape */}
            <Path
              d="M110 20 Q130 60 190 140 Q110 120 30 140 Q90 60 110 20"
              fill="none"
              stroke="#19e6f7"
              strokeWidth={12}
            />
            {/* Circles at triangle points */}
            <Circle cx={110} cy={20} r={13} fill="#fff" stroke="#19e6f7" strokeWidth={7} />
            <Circle cx={190} cy={140} r={13} fill="#fff" stroke="#19e6f7" strokeWidth={7} />
            <Circle cx={30} cy={140} r={13} fill="#fff" stroke="#19e6f7" strokeWidth={7} />
          </Svg>
          <Text style={styles.title}>ATTENDANCE PORTAL</Text>
        </View>
      </View>
      {/* Get Started Button */}
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Get Started</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181533',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  flexGrow: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    color: '#19e6f7',
    fontSize: 24,
    letterSpacing: 4,
    marginTop: 24,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4682a9',
    paddingVertical: 22,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 60,
    width: '85%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '500',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginRight: 18,
  },
  arrow: {
    color: '#181533',
    fontSize: 40,
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
