import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ModalConfirmDeleteProps = {
  onConfirm: () => void;
  onClose: () => void;
};

export function ModalConfirmDelete({ onConfirm, onClose }: ModalConfirmDeleteProps) {
  const theme = useTheme();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable>
          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Delete photo?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Are you sure? This can&apos;t be undone.
            </ThemedText>

            <View style={styles.buttons}>
              <Pressable onPress={onClose}>
                <ThemedText type="smallBold" themeColor="textSecondary">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.deleteText}>Delete</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.four,
  },
  deleteButton: {
    backgroundColor: '#F87171',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  deleteText: {
    color: '#111111',
  },
  pressed: {
    opacity: 0.7,
  },
});
