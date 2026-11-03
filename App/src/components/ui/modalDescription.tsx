import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ModalDescriptionProps = {
  description: string | null | undefined;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
};

export function ModalDescription({ description, onSave, onClose }: ModalDescriptionProps) {
  const theme = useTheme();
  const [text, setText] = useState(description ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(text);
    setSaving(false);
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Edit description</ThemedText>

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            multiline
            autoFocus
            maxLength={250}
            placeholder="Hi. Welcome to my profile"
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
            {text.length}/250
          </ThemedText>

          <View style={styles.buttons}>
            <Pressable onPress={onClose} disabled={saving}>
              <ThemedText type="smallBold" themeColor="textSecondary">Cancel</ThemedText>
            </Pressable>
            <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
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
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.four,
  },
  saveButton: {
    backgroundColor: '#FFD84D',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  saveText: {
    color: '#111111',
  },
  pressed: {
    opacity: 0.7,
  },
});
