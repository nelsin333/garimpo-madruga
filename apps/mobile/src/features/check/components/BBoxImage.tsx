import type { BBox } from '@garimpo/contracts';
import { useTheme } from '@garimpo/ui';
import { Image } from 'expo-image';
import { View } from 'react-native';

export interface BBoxImageProps {
  uri: string;
  bbox: BBox | null;
  /** Cor da marcação (padrão: cor de risco/atenção do tema). */
  color?: string;
  aspectRatio?: number;
}

/** Foto do laudo com a região analisada destacada por bounding box normalizada. */
export function BBoxImage({ uri, bbox, color, aspectRatio = 4 / 3 }: BBoxImageProps) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.brand.primary;

  return (
    <View
      style={{
        width: '100%',
        aspectRatio,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: theme.colors.bg.overlay,
      }}
    >
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={200}
      />
      {bbox ? (
        <>
          {/* Escurece fora da região para guiar o olho */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#00000055',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${bbox.x * 100}%`,
              top: `${bbox.y * 100}%`,
              width: `${bbox.w * 100}%`,
              height: `${bbox.h * 100}%`,
              borderWidth: 2,
              borderColor: stroke,
              borderRadius: theme.radius.sm,
              backgroundColor: '#00000000',
              shadowColor: stroke,
              shadowOpacity: 0.6,
              shadowRadius: 8,
            }}
          >
            {/* "Janela" clara dentro da bbox */}
            <View
              style={{
                position: 'absolute',
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderWidth: 2,
                borderColor: stroke,
                borderRadius: theme.radius.sm,
              }}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}
