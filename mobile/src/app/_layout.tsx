import { Stack } from "expo-router";
import { useFonts, Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from "@expo-google-fonts/source-sans-3";

export default function RootLayout() {
  const [loaded] = useFonts({ Fraunces_700Bold, SourceSans3_400Regular, SourceSans3_600SemiBold });
  if (!loaded) return null;   // wait until fonts are ready
  return <Stack screenOptions={{ headerShown: false }} />;
}