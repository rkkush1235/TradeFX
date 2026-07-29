import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ReactElement, type Ref } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewNavigation, type WebViewProps } from "react-native-webview";
import { WEB_APP_ORIGIN, WEB_APP_URL } from "./src/config";

void SplashScreen.preventAutoHideAsync();

const TradeWebView = WebView as unknown as (props: WebViewProps & { ref?: Ref<WebView> }) => ReactElement;

const injectedJavaScript = `
  (function () {
    document.documentElement.style.webkitUserSelect = 'none';
    document.documentElement.style.webkitTouchCallout = 'none';
    const meta = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
    if (!meta.parentNode) document.head.appendChild(meta);
  })();
  true;
`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return () => subscription();
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backSubscription.remove();
  }, [canGoBack]);

  const hideSplash = useCallback(async () => {
    setLoading(false);
    await SplashScreen.hideAsync();
  }, []);

  const reload = () => {
    setLoading(true);
    webViewRef.current?.reload();
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const shouldStartLoad = (request: { url: string }) => {
    if (request.url.startsWith(WEB_APP_ORIGIN) || request.url.startsWith("about:blank")) {
      return true;
    }

    Linking.openURL(request.url).catch(() => undefined);
    return false;
  };

  const webViewProps: WebViewProps = {
    source: { uri: WEB_APP_URL },
    style: styles.webview,
    containerStyle: styles.webviewContainer,
    javaScriptEnabled: true,
    domStorageEnabled: true,
    sharedCookiesEnabled: true,
    thirdPartyCookiesEnabled: true,
    setSupportMultipleWindows: false,
    pullToRefreshEnabled: Platform.OS === "android",
    injectedJavaScriptBeforeContentLoaded: injectedJavaScript,
    originWhitelist: ["https://*", "http://*", "tradefx://*"],
    onLoadEnd: hideSplash,
    onNavigationStateChange: handleNavigationChange,
    onShouldStartLoadWithRequest: shouldStartLoad,
    onError: hideSplash,
    onHttpError: hideSplash,
    startInLoadingState: true,
    renderLoading: LoadingOverlay,
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" backgroundColor="#070a11" />
        {!online ? <OfflineBanner onRetry={reload} /> : null}

        <TradeWebView ref={webViewRef} {...webViewProps} />

        {loading ? <LoadingOverlay /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function LoadingOverlay() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#22c55e" size="large" />
      <Text style={styles.loadingText}>Opening Trade FX</Text>
    </View>
  );
}

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.offlineBanner}>
      <View style={styles.offlineTextWrap}>
        <Text style={styles.offlineTitle}>No internet connection</Text>
        <Text style={styles.offlineBody}>Trade FX needs internet for login, markets, wallet and admin actions.</Text>
      </View>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070a11",
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#070a11",
  },
  webview: {
    flex: 1,
    backgroundColor: "#070a11",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#070a11",
    gap: 12,
  },
  loadingText: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
  },
  offlineBanner: {
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239,68,68,0.35)",
    backgroundColor: "#2a0f15",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  offlineTextWrap: {
    flex: 1,
  },
  offlineTitle: {
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "700",
  },
  offlineBody: {
    marginTop: 2,
    color: "#fca5a5",
    fontSize: 11,
  },
  retryButton: {
    borderRadius: 8,
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
