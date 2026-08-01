import Ionicons from '@expo/vector-icons/Ionicons';
import { PHOTO_ISSUE_LABELS, type PhotoQuality } from '@garimpo/contracts';
import { Button, Screen, Text, useTheme } from '@garimpo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { analyzePhotoQuality } from '@/features/check/quality';
import { uploadReferencePhoto } from '@/features/reference/api';

type Phase =
  | { kind: 'camera' }
  | { kind: 'analyzing'; uri: string }
  | { kind: 'preview'; uri: string; quality: PhotoQuality }
  | { kind: 'uploading' };

/** Captura de acervo: várias fotos em sequência para a mesma região. */
export default function ExpertCaptureScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id, region, label } = useLocalSearchParams<{
    id: string;
    region: string;
    label: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [savedCount, setSavedCount] = useState(0);

  async function capture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
    if (!photo) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase({ kind: 'analyzing', uri: photo.uri });
    try {
      const quality = await analyzePhotoQuality(photo.uri);
      setPhase({ kind: 'preview', uri: photo.uri, quality });
    } catch {
      setPhase({
        kind: 'preview',
        uri: photo.uri,
        quality: {
          ok: true,
          issues: [],
          metrics: { sharpness: 0, brightness: 0, overexposed_ratio: 0, detail_coverage: 0 },
        },
      });
    }
  }

  async function accept(uri: string, quality: PhotoQuality) {
    setPhase({ kind: 'uploading' });
    try {
      await uploadReferencePhoto({ itemId: id, region, localUri: uri, quality });
      setSavedCount((count) => count + 1);
      void queryClient.invalidateQueries({ queryKey: ['reference-photo-counts', id] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase({ kind: 'camera' }); // segue para a próxima foto da mesma região
    } catch {
      Alert.alert('Falha no envio', 'Confira sua conexão e tente novamente.');
      setPhase({ kind: 'preview', uri, quality });
    }
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.xl }}>
          <Text variant="titleLg" style={{ textAlign: 'center' }}>
            Precisamos da câmera
          </Text>
          <Button title="Permitir câmera" onPress={() => void requestPermission()} />
          <Button variant="ghost" size="md" title="Voltar" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {phase.kind === 'camera' || phase.kind === 'uploading' ? (
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      ) : (
        <Image source={{ uri: phase.uri }} style={{ flex: 1 }} contentFit="cover" />
      )}

      <View
        style={{
          position: 'absolute',
          top: insets.top + theme.space.md,
          left: theme.space.xl,
          right: theme.space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Concluir região"
          hitSlop={theme.space.md}
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#00000088',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={22} color="#FFF" />
        </Pressable>
        <View
          style={{
            backgroundColor: '#00000088',
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.space.lg,
            paddingVertical: theme.space.sm,
          }}
        >
          <Text variant="caption" style={{ color: '#FFF' }}>
            {(label ?? region).toUpperCase()} · {savedCount} salvas
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + theme.space.xl,
          paddingTop: theme.space.xl,
          paddingHorizontal: theme.space.xl,
          backgroundColor: '#000000CC',
          gap: theme.space.lg,
        }}
      >
        {phase.kind === 'camera' ? (
          <View style={{ alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tirar foto"
              onPress={() => void capture()}
              style={({ pressed }) => ({
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 4,
                borderColor: '#FFF',
                backgroundColor: pressed ? theme.colors.brand.primaryPressed : '#FFFFFF22',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: theme.colors.brand.primary,
                }}
              />
            </Pressable>
          </View>
        ) : phase.kind === 'analyzing' || phase.kind === 'uploading' ? (
          <View
            style={{ alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.lg }}
          >
            <ActivityIndicator color={theme.colors.brand.primary} />
            <Text variant="caption" style={{ color: '#FFFFFFBB' }}>
              {phase.kind === 'analyzing' ? 'Verificando qualidade…' : 'Enviando…'}
            </Text>
          </View>
        ) : (
          <>
            {!phase.quality.ok ? (
              <View style={{ gap: theme.space.xs }}>
                {phase.quality.issues.map((issue) => (
                  <View
                    key={issue}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}
                  >
                    <Ionicons name="alert-circle" size={16} color={theme.colors.feedback.warning} />
                    <Text variant="caption" style={{ color: '#FFF', flex: 1 }}>
                      {PHOTO_ISSUE_LABELS[issue]}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: theme.space.md }}>
              <Button
                variant="secondary"
                size="md"
                title="Refazer"
                style={{ flex: 1 }}
                onPress={() => setPhase({ kind: 'camera' })}
              />
              <Button
                size="md"
                title={phase.quality.ok ? 'Salvar foto' : 'Salvar mesmo assim'}
                style={{ flex: 1 }}
                onPress={() => void accept(phase.uri, phase.quality)}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
