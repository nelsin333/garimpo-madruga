import Ionicons from '@expo/vector-icons/Ionicons';
import type { PhotoChecklistStep } from '@garimpo/contracts';
import { Text, useTheme } from '@garimpo/ui';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { regionIcon } from '../regions';
import type { WizardPhoto } from '../store';

export interface PhotoSlotProps {
  step: PhotoChecklistStep;
  photo: WizardPhoto | undefined;
  onPress: () => void;
}

/** Slot de foto do checklist: vazio, enviando, ok, com aviso ou com erro. */
export function PhotoSlot({ step, photo, onPress }: PhotoSlotProps) {
  const theme = useTheme();

  const badge = !photo ? null : photo.upload === 'uploading' ? (
    <ActivityIndicator size="small" color={theme.colors.text.onBrand} />
  ) : photo.upload === 'error' ? (
    <Ionicons name="refresh" size={14} color={theme.colors.text.onBrand} />
  ) : photo.quality && !photo.quality.ok ? (
    <Ionicons name="alert" size={14} color={theme.colors.text.onBrand} />
  ) : (
    <Ionicons name="checkmark" size={14} color={theme.colors.text.onBrand} />
  );

  const badgeColor = !photo
    ? 'transparent'
    : photo.upload === 'error'
      ? theme.colors.feedback.danger
      : photo.upload === 'uploading'
        ? theme.colors.text.tertiary
        : photo.quality && !photo.quality.ok
          ? theme.colors.feedback.warning
          : theme.colors.feedback.success;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${step.label}${photo ? ' — refazer foto' : ' — tirar foto'}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '47.5%',
        aspectRatio: 1,
        borderRadius: theme.radius.lg,
        borderWidth: photo ? 1 : 1.5,
        borderStyle: photo ? 'solid' : 'dashed',
        borderColor: pressed
          ? theme.colors.brand.primary
          : photo
            ? theme.colors.border.subtle
            : step.required
              ? theme.colors.border.strong
              : theme.colors.border.subtle,
        backgroundColor: theme.colors.bg.raised,
        overflow: 'hidden',
      })}
    >
      {photo ? (
        <Image
          source={{ uri: photo.localUri }}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      {/* Gradiente fake para legibilidade do rótulo sobre a foto */}
      {photo ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            height: '45%',
            backgroundColor: '#00000088',
          }}
        />
      ) : null}

      <View style={{ flex: 1, padding: theme.space.md, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {!photo ? (
            <Ionicons
              name={regionIcon(step.region)}
              size={22}
              color={theme.colors.text.secondary}
            />
          ) : (
            <View />
          )}
          {badge ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: badgeColor,
              }}
            >
              {badge}
            </View>
          ) : null}
        </View>
        <View style={{ gap: 1 }}>
          <Text variant="caption" style={photo ? { color: '#FFFFFF' } : undefined}>
            {step.label}
          </Text>
          {!step.required && !photo ? (
            <Text variant="caption" color="tertiary">
              opcional
            </Text>
          ) : null}
          {photo?.upload === 'error' ? (
            <Text variant="caption" style={{ color: theme.colors.feedback.danger }}>
              falha no envio — toque
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
