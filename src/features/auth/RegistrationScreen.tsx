import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = { onBack: () => void };
type FieldErrors = Partial<Record<"name" | "username" | "email" | "password" | "confirmPassword" | "terms", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z][a-z0-9_]{2,23}$/;

function validate(values: {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 2 || values.name.trim().length > 60) {
    errors.name = "Enter a name between 2 and 60 characters.";
  }
  if (!usernamePattern.test(values.username.trim())) {
    errors.username = "Use 3–24 characters: lowercase letters, numbers or underscores. Start with a letter.";
  }
  if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (values.password.length < 12) {
    errors.password = "Use at least 12 characters.";
  }
  if (values.confirmPassword !== values.password || !values.confirmPassword) {
    errors.confirmPassword = "Your passwords do not match.";
  }
  if (!values.acceptedTerms) {
    errors.terms = "You must accept the terms to continue.";
  }
  return errors;
}

export default function RegistrationScreen({ onBack }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");

  const submit = () => {
    const nextErrors = validate({ name, username, email, password, confirmPassword, acceptedTerms });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice("");
      return;
    }
    setNotice(
      "Your details passed the on-device checks. Account creation and email verification are not connected yet. Nothing has been sent or saved."
    );
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    error?: string,
    secureTextEntry = false,
    keyboardType: "default" | "email-address" = "default",
    autoCapitalize: "none" | "words" = "none"
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => {
          onChangeText(label === "USERNAME" ? text.toLowerCase() : text);
          setNotice("");
        }}
        placeholder={placeholder}
        placeholderTextColor="#71809A"
        style={[styles.input, error ? styles.inputError : null]}
        selectionColor="#8CB8FF"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backText}>‹  BACK</Text>
        </Pressable>

        <Text style={styles.brand}>CREOVA</Text>
        <Text style={styles.tagline}>CREATE. CONNECT. EVOLVE.</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start with your identity. You can build your profile next.</Text>

        {field("FULL NAME", name, setName, "Your name", errors.name, false, "default", "words")}
        {field("USERNAME", username, setUsername, "Choose a username", errors.username)}
        {field("EMAIL ADDRESS", email, setEmail, "you@example.com", errors.email, false, "email-address")}

        <View style={styles.field}>
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={(value) => { setPassword(value); setNotice(""); }}
              placeholder="At least 12 characters"
              placeholderTextColor="#71809A"
              style={[styles.passwordInput, errors.password ? styles.inputError : null]}
              selectionColor="#8CB8FF"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Password"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
              <Text style={styles.showText}>{showPassword ? "HIDE" : "SHOW"}</Text>
            </Pressable>
          </View>
          {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={confirmPassword}
              onChangeText={(value) => { setConfirmPassword(value); setNotice(""); }}
              placeholder="Enter your password again"
              placeholderTextColor="#71809A"
              style={[styles.passwordInput, errors.confirmPassword ? styles.inputError : null]}
              selectionColor="#8CB8FF"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Confirm password"
            />
            <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.showButton}>
              <Text style={styles.showText}>{showConfirmPassword ? "HIDE" : "SHOW"}</Text>
            </Pressable>
          </View>
          {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}
        </View>

        <Pressable
          onPress={() => { setAcceptedTerms(!acceptedTerms); setNotice(""); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedTerms }}
          style={styles.termsRow}
        >
          <View style={[styles.checkbox, acceptedTerms ? styles.checkboxChecked : null]}>
            {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.termsText}>I agree to CREOVA's Terms and Privacy Policy.</Text>
        </Pressable>
        {errors.terms ? <Text style={styles.error}>{errors.terms}</Text> : null}

        <Pressable onPress={submit} accessibilityRole="button" style={styles.submit}>
          <Text style={styles.submitText}>CHECK DETAILS</Text>
        </Pressable>

        {notice ? (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.noticeTitle}>LOCAL CHECK COMPLETE</Text>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <Text style={styles.privacyNote}>
          Your entries stay in this screen only. This preview does not create an account, contact a provider or transmit your information.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070A12" },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40 },
  back: { alignSelf: "flex-start", paddingVertical: 10, paddingRight: 18 },
  backText: { color: "#8CB8FF", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  brand: { color: "#F4F7FF", fontSize: 25, fontWeight: "900", letterSpacing: 4, marginTop: 16 },
  tagline: { color: "#8295BA", fontSize: 9, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  title: { color: "#FFFFFF", fontSize: 27, fontWeight: "800", marginTop: 30 },
  subtitle: { color: "#A4B2CA", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { color: "#B8C8E4", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8 },
  input: {
    minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: "#263653",
    backgroundColor: "#0D1423", color: "#FFFFFF", paddingHorizontal: 15, fontSize: 14,
  },
  passwordRow: {
    minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: "#263653",
    backgroundColor: "#0D1423", flexDirection: "row", alignItems: "center",
  },
  passwordInput: { flex: 1, minHeight: 50, color: "#FFFFFF", paddingHorizontal: 15, fontSize: 14 },
  showButton: { paddingHorizontal: 13, paddingVertical: 12 },
  showText: { color: "#8CB8FF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  inputError: { borderColor: "#D66A79" },
  error: { color: "#FF9AA8", fontSize: 11, lineHeight: 16, marginTop: 6 },
  termsRow: { flexDirection: "row", alignItems: "center", marginTop: 3, marginBottom: 5 },
  checkbox: {
    width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: "#58739E",
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  checkboxChecked: { backgroundColor: "#2B5DA4", borderColor: "#75A8F5" },
  checkmark: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  termsText: { color: "#B6C4DE", fontSize: 12, flex: 1 },
  submit: {
    minHeight: 54, borderRadius: 15, backgroundColor: "#28599E",
    alignItems: "center", justifyContent: "center", marginTop: 22,
    borderWidth: 1, borderColor: "#4D83CC",
  },
  submitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", letterSpacing: 1.6 },
  notice: { marginTop: 16, borderRadius: 13, padding: 14, backgroundColor: "#10233B", borderWidth: 1, borderColor: "#315B89" },
  noticeTitle: { color: "#9FC4FF", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  noticeText: { color: "#D5E2F6", fontSize: 12, lineHeight: 18, marginTop: 7 },
  privacyNote: { color: "#71809A", fontSize: 10, lineHeight: 16, marginTop: 18, textAlign: "center" },
});
