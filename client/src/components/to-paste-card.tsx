import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import type { Sticker } from '@/lib/queries/albums';
import { r2Url } from '@/lib/storage';

interface Props {
  sticker: Sticker;
  // Stock disponible en el bolsillo (quantity - (pasted ? 1 : 0)).
  stock: number;
  // Si false, esconde el botón "Pegar" (la figurita ya está pegada, solo
  // tiene sentido cambiar las extras).
  canPaste: boolean;
  // Pegar en el álbum.
  onPaste: () => void;
  // Ir a la pantalla de cambios con esta figurita preseleccionada.
  onTrade: () => void;
  // Tap general en el card → abre la vista grande.
  onPress?: () => void;
  busy?: boolean;
}

// Card horizontal de una figurita que el user tiene en colección pero no
// pegó todavía. Muestra thumb + #N + nombre + counter de repes + botones
// Pegar (primario) y Cambiar (outline). Se usa en la sección "Sin pegar"
// del álbum del user.
export function ToPasteCard({ sticker, stock, canPaste, onPaste, onTrade, onPress, busy }: Props) {
  const url = r2Url(sticker.thumb_key);
  const borderColor = RarityFrame[sticker.rarity];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.thumb, { borderColor }]}>
        {url && (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
        {stock > 1 && (
          <View style={styles.repeBadge}>
            <Text style={styles.repeText}>×{stock}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.number}>#{String(sticker.number).padStart(3, '0')}</Text>
        <Text style={styles.name} numberOfLines={2}>{sticker.name}</Text>
        <Text style={styles.extras}>
          {canPaste
            ? stock > 1
              ? `Sin pegar · ${stock - 1} repe${stock - 1 > 1 ? 's' : ''}`
              : 'Sin pegar'
            : `${stock} repe${stock > 1 ? 's' : ''}`}
        </Text>
      </View>

      <View style={styles.actions}>
        {canPaste && (
          <Button
            label="Pegar"
            variant="gold"
            onPress={onPaste}
            disabled={busy}
            loading={busy}
            style={styles.actionBtn}
          />
        )}
        <Button
          label="Cambiar"
          variant="outline"
          onPress={onTrade}
          style={styles.actionBtn}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: { opacity: 0.9 },
  thumb: {
    width: 64,
    height: 78,
    borderRadius: Radius.cell,
    borderWidth: 2,
    backgroundColor: Colors.paper2,
    overflow: 'hidden',
  },
  repeBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: Colors.green,
    borderRadius: 4,
  },
  repeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.greenTextDark,
    fontWeight: '800',
  },
  info: { flex: 1, gap: 2 },
  number: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  name: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
    lineHeight: 16,
  },
  extras: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.green,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  actions: {
    gap: Spacing.xs,
    alignItems: 'stretch',
    minWidth: 88,
  },
  actionBtn: {
    minHeight: 32,
    paddingVertical: 0,
    paddingHorizontal: Spacing.sm,
  },
});
