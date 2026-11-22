import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  Pressable,
  View,
  ScrollView,
} from "react-native";
import RegistrationScreen from "./src/features/auth/RegistrationScreen";

type Tab = "Home" | "Explore" | "Create" | "Inbox" | "Profile";
const TABS: Tab[] = ["Home", "Explore", "Create", "Inbox", "Profile"];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Home");
  const [showRegistration, setShowRegistration] = useState(false);

  if (showRegistration) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <RegistrationScreen onBack={() => setShowRegistration(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.wordmark}>CREOVA</Text>
            <Text style={styles.tagline}>CREATE. CONNECT. EVOLVE.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a CREOVA account"
            onPress={() => setShowRegistration(true)}
            style={styles.joinButton}
          >
            <Text style={styles.joinButtonText}>JOIN</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>YOUR WORLD</Text>
          <Text style={styles.heading}>{activeTab}</Text>
          <View style={styles.hero}>
            <View style={styles.orbit} />
            <Text style={styles.heroKicker}>A NEW WAY TO BE SOCIAL</Text>
            <Text style={styles.heroTitle}>Your world.{"\n"}Your people.{"\n"}Your next move.</Text>
            <Text style={styles.heroBody}>
              A platform built for sharing, discovering and creating — with the tools to do more.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>THE CREOVA FOUNDATION</Text>
            <Text style={styles.sectionMeta}>IN PROGRESS</Text>
          </View>
          <View style={styles.steps}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>01</Text>
              <Text style={styles.stepTitle}>CONNECT</Text>
              <Text style={styles.stepBody}>Find people and communities.</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>02</Text>
              <Text style={styles.stepTitle}>CREATE</Text>
              <Text style={styles.stepBody}>Share photos, video and ideas.</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>03</Text>
              <Text style={styles.stepTitle}>EVOLVE</Text>
              <Text style={styles.stepBody}>Build your presence over time.</Text>
            </View>
          </View>
          <Text style={styles.disclaimer}>
            Foundation preview · Features are added and verified in stages.
          </Text>
        </ScrollView>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const selected = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab)}
                style={styles.tab}
              >
                <Text style={[styles.tabGlyph, selected && styles.selectedText]}>
                  {tab === "Home" ? "⌂" : tab === "Explore" ? "⌕" : tab === "Create" ? "+" : tab === "Inbox" ? "▤" : "◉"}
                </Text>
                <Text style={[styles.tabLabel, selected && styles.selectedText]}>{tab}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070A12" },
  app: { flex: 1, backgroundColor: "#070A12" },
  header: {
    minHeight: 68, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#1A2235",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  wordmark: { color: "#F4F7FF", fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  tagline: { color: "#8295BA", fontSize: 9, fontWeight: "700", letterSpacing: 2, marginTop: 3 },
  joinButton: {
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: "#244F91", borderWidth: 1, borderColor: "#477CC9",
  },
  joinButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  content: { padding: 20, paddingBottom: 28 },
  eyebrow: { color: "#6E9FFF", fontSize: 10, fontWeight: "800", letterSpacing: 2.5, marginTop: 8 },
  heading: { color: "#F4F7FF", fontSize: 30, fontWeight: "800", marginTop: 5, marginBottom: 20 },
  hero: {
    minHeight: 260, borderRadius: 24, padding: 24, overflow: "hidden",
    backgroundColor: "#101B34", borderWidth: 1, borderColor: "#253D69", justifyContent: "center",
  },
  orbit: {
    position: "absolute", width: 230, height: 230, borderRadius: 115,
    borderWidth: 1, borderColor: "#315B9B", right: -80, top: -85,
  },
  heroKicker: { color: "#8CB8FF", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  heroTitle: { color: "#FFFFFF", fontSize: 32, lineHeight: 38, fontWeight: "800", marginTop: 14 },
  heroBody: { color: "#B6C4DE", fontSize: 13, lineHeight: 20, marginTop: 14, maxWidth: 280 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 28, marginBottom: 12,
  },
  sectionTitle: { color: "#E7EDFA", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  sectionMeta: { color: "#7EA9F5", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  steps: { gap: 10 },
  step: { backgroundColor: "#0D1322", borderWidth: 1, borderColor: "#1D2A43", borderRadius: 16, padding: 16 },
  stepNumber: { color: "#6E9FFF", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  stepTitle: { color: "#F4F7FF", fontSize: 14, fontWeight: "800", marginTop: 7, letterSpacing: 1 },
  stepBody: { color: "#A4B2CA", fontSize: 12, marginTop: 5 },
  disclaimer: { color: "#71809A", fontSize: 10, textAlign: "center", marginTop: 18 },
  tabBar: {
    minHeight: 66, borderTopWidth: 1, borderTopColor: "#1A2235",
    backgroundColor: "#090E19", flexDirection: "row", justifyContent: "space-around",
    alignItems: "center", paddingHorizontal: 5, paddingBottom: 4,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 54 },
  tabGlyph: { color: "#71809A", fontSize: 21, fontWeight: "700" },
  tabLabel: { color: "#71809A", fontSize: 9, fontWeight: "700" },
  selectedText: { color: "#8CB8FF" },
});
