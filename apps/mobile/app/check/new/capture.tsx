import Ionicons from '@expo/vector-icons/Ionicons';
import { PHOTO_ISSUE_LABELS, type PhotoQuality } from '@garimpo/contracts';
import { Button, Screen, Text, useTheme } from '@garimpo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { uploadCheckPhoto } from '@/features/check/api';
import { analyzePhotoQuality } from '@/features/check/quality';
import { useCheckWizard } from '@/features/check/store';

type Phase =
  | { kind: 'camera' }
  | { kind: 'analyzing'; uri: string }
  | { kind: 'preview'; uri: string; quality: PhotoQuality };

export default function CaptureScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { region } = useLocalSearchParams<{ region: string }>();
  const wizard = useCheckWizard();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });

  const step = wizard.checklist.find((s) => s.region === region);
  if (!step || !session) {
    router.back();
    return null;
  }

  async function capture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
    if (!photo) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase({ kind: 'analyzing', uri: photo.uri });
    try {
      const quality = await analyzePhotoQuality(photo.uri);
      setPhase({ kind: 'preview', uri: photo.uri, quality });
      if (!quality.ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // análise falhou: não bloqueia o fluxo, segue sem métricas
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

  function accept(uri: string, quality: PhotoQuality) {
    const currentRegion = step!.region;
    wizard.upsertPhoto({ region: currentRegion, localUri: uri, quality, upload: 'uploading' });
    void uploadCheckPhoto({
      checkId: wizard.checkId!,
      profileId: session!.user.id,
      region: currentRegion,
      localUri: uri,
      quality,
    })
      .then(() => useCheckWizard.getState().setPhotoUpload(currentRegion, 'uploaded'))
      .catch(() => useCheckWizard.getState().setPhotoUpload(currentRegion, 'error'));
    router.back();
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.xl }}>
          <Text variant="titleLg" style={{ textAlign: 'center' }}>
            Precisamos da câmera
          </Text>
          <Text color="secondary" style={{ textAlign: 'center' }}>
            As fotos da peça são tiradas dentro do app para garantir a autenticidade da análise.
          </Text>
          <Button
            title={permission?.canAskAgain === false ? 'Abrir ajustes' : 'Permitir câmera'}
            onPress={() => void requestPermission()}
          />
          <Button variant="ghost" size="md" title="Voltar" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const isPreview = phase.kind !== 'camera';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Câmera ou foto capturada */}
      {phase.kind === 'camera' ? (
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      ) : (
        <Image source={{ uri: phase.uri }} style={{ flex: 1 }} contentFit="cover" />
      )}

      {/* Overlay superior: fechar + rótulo da região */}
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
          accessibilityLabel="Fechar câmera"
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
          <Ionicons name="close" size={22} color="#FFF" />
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
            {step.label.toUpperCase()}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Moldura tracejada de enquadramento */}
      {phase.kind === 'camera' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '22%',
            bottom: '28%',
            left: '10%',
            right: '10%',
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: '#FFFFFF99',
            borderRadius: theme.radius.lg,
          }}
        />
      ) : null}

      {/* Painel inferior */}
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
          <>
            <Text variant="caption" style={{ color: '#FFFFFFBB', textAlign: 'center' }}>
              💡 {step.hint}
            </Text>
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
          </>
        ) : phase.kind === 'analyzing' ? (
          <View
            style={{ alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.lg }}
          >
            <ActivityIndicator color={theme.colors.brand.primary} />
            <Text variant="caption" style={{ color: '#FFFFFFBB' }}>
              Verificando qualidade…
            </Text>
          </View>
        ) : (
          <>
            {phase.quality.ok ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.sm,
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.feedback.success} />
                <Text variant="caption" style={{ color: '#FFF' }}>
                  Foto nítida e bem iluminada
                </Text>
              </View>
            ) : (
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
            )}

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
                title={phase.quality.ok ? 'Usar foto' : 'Usar mesmo assim'}
                style={{ flex: 1 }}
                onPress={() => accept(phase.uri, phase.quality)}
              />
            </View>
          </>
        )}
      </View>

      {/* Acessibilidade: estado atual para leitores de tela */}
      {isPreview ? null : null}
    </View>
  );
}
