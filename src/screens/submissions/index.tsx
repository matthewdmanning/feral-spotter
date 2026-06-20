import { ScrollView /*, Pressable*/, Text, View } from "react-native";
// import { router } from 'expo-router'
import { useSubmissionStore } from "@/src/hooks";
import { CheckCircle } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { styles } from "./index.styles";

export default function SubmissionsScreen() {
  const { theme } = useUnistyles();
  const history = useSubmissionStore((s) => s.history);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Submissions</Text>
        <Text style={styles.subtitle}>Your observation history.</Text>
      </View>
      {history.length === 0 ? (
        <View style={styles.card}>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No submissions yet</Text>
            <Text style={styles.emptySubtext}>
              Start your first observation from the Home tab
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {history.map((sub) => (
              <View key={sub.id} style={styles.card}>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.catCount}>
                      {sub.cats.length} cat{sub.cats.length !== 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(sub.submitted_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.location}>
                    Location: {sub.location_type}
                  </Text>
                  {sub.status === "submitted" && (
                    <View style={styles.submittedRow}>
                      <CheckCircle size={14} color={theme.colors.success} />
                      <Text style={styles.submittedText}>Submitted</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
