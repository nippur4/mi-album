// Card en la vista owner que muestra la probabilidad de cada rareza por sobre.
// Sirve para que el owner vea qué tan bien queda su distribución de figuritas
// dado el algoritmo del backend (peso por figurita, ver lib/pack-probability).
//
// Tap → abre un modal con el detalle figurita-por-figurita: prob por pick,
// prob por sobre completo, y sobres esperados para conseguir una copia.

import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Radius, RarityFrame, Spacing } from '@/constants/theme';
import type { Sticker } from '@/lib/queries/albums';
import {
  computePackProbability,
  expectedPacksToGetSticker,
  probInPackForSticker,
  probPerPickForSticker,
  RARITY_LABEL,
  type Rarity,
} from '@/lib/pack-probability';

interface Props {
  stickers: Sticker[];
  packSize: number;
}

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export function PackProbabilityCard({ stickers, packSize }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const prob = useMemo(() => computePackProbability(stickers, packSize), [stickers, packSize]);

  // Sin figuritas cargadas no hay nada que calcular.
  if (stickers.length === 0 || prob.totalWeight === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => setDetailOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.head}>
          <Text style={styles.label}>QUÉ ESPERAR EN CADA SOBRE</Text>
          <Feather name="chevron-right" size={18} color={Colors.muted} />
        </View>
        <View style={styles.rows}>
          {RARITY_ORDER.map((r) => {
            const row = prob.byRarity.find((b) => b.rarity === r)!;
            const zero = row.count === 0;
            return (
              <View key={r} style={styles.row}>
                <View style={[styles.pill, { backgroundColor: RarityFrame[r] }]}>
                  <Text style={styles.pillText}>{RARITY_LABEL[r].toUpperCase()}</Text>
                </View>
                <Text style={[styles.rowValue, zero && styles.rowValueDisabled]}>
                  {zero
                    ? '—'
                    : `${row.expectedPerPack.toFixed(row.expectedPerPack < 1 ? 2 : 1)}`}
                </Text>
                <Text style={styles.rowUnit}>por sobre</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.footer}>Tocá para ver el detalle por figurita</Text>
      </Pressable>

      <DetailModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        stickers={stickers}
        packSize={packSize}
        totalWeight={prob.totalWeight}
      />
    </>
  );
}

// Modal con la tabla completa por figurita. Ordenado por rareza (legendarias
// primero) y dentro de cada rareza por número.
function DetailModal({
  visible,
  onClose,
  stickers,
  packSize,
  totalWeight,
}: {
  visible: boolean;
  onClose: () => void;
  stickers: Sticker[];
  packSize: number;
  totalWeight: number;
}) {
  const rows = useMemo(() => {
    const rarityRank: Record<Rarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
    return [...stickers].sort((a, b) => {
      const dr = rarityRank[a.rarity as Rarity] - rarityRank[b.rarity as Rarity];
      if (dr !== 0) return dr;
      return a.number - b.number;
    });
  }, [stickers]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Probabilidad por figurita</Text>
          <Text style={styles.subtitle}>
            En cada sobre de {packSize}, esta es la chance de que aparezca cada figurita al
            menos una vez, y cuántos sobres necesitás en promedio para verla.
          </Text>

          <View style={styles.header}>
            <Text style={[styles.headerCell, { flex: 2 }]}>FIGURITA</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>POR SOBRE</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>≈ SOBRES</Text>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(s) => s.id}
            initialNumToRender={20}
            renderItem={({ item }) => {
              const rarity = item.rarity as Rarity;
              const inPack = probInPackForSticker(totalWeight, rarity, packSize);
              const expected = expectedPacksToGetSticker(totalWeight, rarity, packSize);
              return (
                <View style={styles.detailRow}>
                  <View style={[{ flex: 2 }, styles.stickerCell]}>
                    <View style={[styles.rarityDot, { backgroundColor: RarityFrame[rarity] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stickerName} numberOfLines={1}>
                        #{String(item.number).padStart(3, '0')} {item.name}
                      </Text>
                      <Text style={styles.stickerRarity}>{RARITY_LABEL[rarity]}</Text>
                    </View>
                  </View>
                  <Text style={[styles.numCell, { flex: 1 }]}>
                    {(inPack * 100).toFixed(inPack < 0.01 ? 2 : 1)}%
                  </Text>
                  <Text style={[styles.numCell, { flex: 1 }]}>
                    {Number.isFinite(expected) ? expected.toFixed(expected < 10 ? 1 : 0) : '—'}
                  </Text>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingBottom: Spacing.md }}
            style={{ flexShrink: 1 }}
          />

          <SafeAreaView edges={['bottom']}>
            <Button label="Cerrar" onPress={onClose} />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardPressed: { opacity: 0.85 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  rows: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pill: {
    minWidth: 92,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  pillText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  rowValue: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.ink,
    minWidth: 44,
  },
  rowValueDisabled: {
    color: Colors.muted,
  },
  rowUnit: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  footer: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: 4,
  },

  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.cardLg,
    borderTopRightRadius: Radius.cardLg,
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '92%',
    gap: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCell: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  stickerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rarityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stickerName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.ink,
    fontWeight: '700',
  },
  stickerRarity: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
  },
  numCell: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    color: Colors.ink,
    textAlign: 'right',
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
