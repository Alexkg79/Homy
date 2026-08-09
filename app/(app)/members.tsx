import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useGroupStore } from '../../hooks/useGroupStore';
import type { GroupMember } from '../../types/database';

export default function Members() {
  const session = useAuthStore((state) => state.session);
  const group = useGroupStore((state) => state.group);
  const members = useGroupStore((state) => state.members);
  const isLoading = useGroupStore((state) => state.isLoading);
  const hasFetched = useGroupStore((state) => state.hasFetched);
  const error = useGroupStore((state) => state.error);
  const fetchGroup = useGroupStore((state) => state.fetchGroup);

  useEffect(() => {
    if (session && (!hasFetched || members.length === 0)) {
      fetchGroup(session.user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!group || (isLoading && members.length === 0)) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <ErrorText>{error}</ErrorText>

      <FlatList
        data={members}
        keyExtractor={(item: GroupMember) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{item.display_name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.memberName}>{item.display_name}</Text>
            {item.user_id === session?.user.id && <Text style={styles.youTag}>toi</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    padding: 24,
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5EBFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#2F6FED',
    fontWeight: '700',
  },
  memberName: {
    fontSize: 16,
    flex: 1,
  },
  youTag: {
    fontSize: 12,
    color: '#999',
  },
});
