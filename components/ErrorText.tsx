import { StyleSheet, Text } from 'react-native';

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: '#D64545',
    fontSize: 14,
  },
});
