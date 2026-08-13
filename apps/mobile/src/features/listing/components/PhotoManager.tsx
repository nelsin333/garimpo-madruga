import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from '@garimpo/ui';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, View } from 'react-native';

export interface ManagedPhoto {
  id: string;
  storage_path: string;
  position: number;
  url: string;
}

export interface PhotoManagerProps {
  photos: ManagedPhoto[];
  onAdd: () => void;
  onRemove: (photo: ManagedPhoto) => void;
  /** Recebe a nova ordem de ids (índice = position). */
  onReorder: (photoIds: string[]) => void;
}

/**
 * Fotos do anúncio: a primeira é a capa. Permite definir capa, mover,
 * remover e adicionar novas da galeria.
 */
export function PhotoManager({ photos, onAdd, onRemove, onReorder }: PhotoManagerProps) {
  const theme = useTheme();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const ids = photos.map((photo) => photo.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved!);
    onReorder(ids);
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const ids = photos.map((photo) => photo.id);
    const [moved] = ids.splice(index, 1);
    ids.unshift(moved!);
    onReorder(ids);
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="secondary">
          Fotos ({photos.length}) — a primeira é a capa
        </Text>
        <Pressable accessibilityRole="button" onPress={onAdd} hitSlop={theme.space.sm}>
          <Text variant="caption" color="brand">
            + Adicionar
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          {photos.map((photo, index) => (
            <View
              key={photo.id}
              style={{
                width: 132,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
                borderWidth: index === 0 ? 2 : 1,
                borderColor: index === 0 ? theme.colors.brand.primary : theme.colors.border.subtle,
                backgroundColor: theme.colors.bg.raised,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={index === 0 ? 'Foto de capa' : 'Definir como capa'}
                onPress={() => makeCover(index)}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={{ width: '100%', aspectRatio: 1 }}
                  contentFit="cover"
                  transition={120}
                />
                {index === 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      backgroundColor: theme.colors.brand.primary,
                      borderRadius: theme.radius.pill,
                      paddingHorizontal: theme.space.sm,
                    }}
                  >
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.text.onBrand, fontSize: 10 }}
                    >
                      capa
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  paddingVertical: 6,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mover para a esquerda"
                  onPress={() => move(index, -1)}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.colors.text.secondary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remover foto"
                  onPress={() =>
                    Alert.alert('Remover foto?', 'Ela sai do anúncio.', [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Remover',
                        style: 'destructive',
                        onPress: () => onRemove(photo),
                      },
                    ])
                  }
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.feedback.danger} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mover para a direita"
                  onPress={() => move(index, 1)}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar foto"
            onPress={onAdd}
            style={{
              width: 132,
              aspectRatio: 0.82,
              borderRadius: theme.radius.md,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: theme.colors.border.strong,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.space.sm,
            }}
          >
            <Ionicons name="add" size={24} color={theme.colors.text.secondary} />
            <Text variant="caption" color="tertiary">
              da galeria
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
