import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Alert,
  BackHandler,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  // const webViewRef = useRef<WebView>(null);
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }

      Alert.alert(
        'Exit App',
        'Do you want to exit the app?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: () => BackHandler.exitApp() },
        ],
        { cancelable: false },
      );

      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#070a11" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TradeFX</Text>
      </View>

      {/* Website */}
      <View style={styles.webContainer}>

        <WebView
          ref={webViewRef}
          source={{ uri: 'https://trade-fx-4ir7.vercel.app/login' }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onNavigationStateChange={(navState) =>
            setCanGoBack(navState.canGoBack)
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a11',
  },

  header: {
    height: 60,
     marginTop: "10%",
    backgroundColor: '#070a11',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#2b2b2b',
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  webContainer: {
    flex: 1,
    paddingBottom: 12, // bottom navigation se thoda upar
  },

  webview: {
    flex: 1,
    backgroundColor: '#070a11',
  },
});