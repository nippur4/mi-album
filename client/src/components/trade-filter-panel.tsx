import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { EMPTY_SEARCH, hasSearch, type TradeSearch } from '@/lib/trade-filter';

interface PanelProps {
  // Búsqueda YA aplicada (fuente de verdad en la pantalla).
  search: TradeSearch;
  // Se dispara al tocar "Buscar" o "Limpiar" — recién ahí corre el filtro de
  // texto (el usuario pidió que nombre/número no busquen en vivo).
  onApply: (s: TradeSearch) => void;
  // true si además hay algún chip/selector activo (para marcar el toggle).
  extraActive?: boolean;
  // Chips (álbum / figurita a cambiar) que van arriba de los campos de texto.
  children?: React.ReactNode;
}

// Panel de filtros colapsable para Ofertas y Coincidencias. Cerrado por
// defecto: se abre al tocar "Filtrar". Los campos de texto (carta / usuario)
// solo se aplican al confirmar con "Buscar".
export function TradeFilterPanel({ search, onApply, extraActive, children }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState(search.card);
  const [user, setUser] = useState(search.user);

  // Si la pantalla resetea la búsqueda por fuera (ej. cambiar de tab), refleja
  // en los drafts.
  useEffect(() => {
    setCard(search.card);
    setUser(search.user);
  }, [search.card, search.user]);

  const active = hasSearch(search) || !!extraActive;

  function apply() {
    onApply({ card: card.trim(), user: user.trim() });
  }
  function clear() {
    setCard('');
    setUser('');
    onApply(EMPTY_SEARCH);
  }

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.toggle} onPress={() => setOpen((o) => !o)} hitSlop={6}>
        <Feather name="filter" size={15} color={active ? Colors.red : Colors.ink} />
        <Text style={[styles.toggleText, active && { color: Colors.red }]}>
          {active ? 'Filtros activos' : 'Filtrar'}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
      </Pressable>

      {open && (
        <View style={styles.panel}>
          {children}
          <TextInput
            placeholder="Carta: nombre o número"
            value={card}
            onChangeText={setCard}
            onSubmitEditing={apply}
            returnKeyType="search"
          />
          <TextInput
            placeholder="Usuario"
            value={user}
            onChangeText={setUser}
            onSubmitEditing={apply}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <View style={styles.actions}>
            {active && (
              <Pressable style={styles.clearBtn} onPress={clear} hitSlop={6}>
                <Text style={styles.clearText}>Limpiar</Text>
              </Pressable>
            )}
            <Pressable style={styles.searchBtn} onPress={apply} hitSlop={6}>
              <Feather name="search" size={15} color={Colors.paper} />
              <Text style={styles.searchText}>Buscar</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export interface ChipOption {
  key: string;
  label: string;
}

interface ChipsProps {
  label?: string;
  options: ChipOption[];
  value: string | null; // null = "Todas"
  onChange: (key: string | null) => void;
  allLabel?: string;
}

// Fila horizontal de chips seleccionables con opción "Todas" al inicio.
export function FilterChips({ label, options, value, onChange, allLabel = 'Todas' }: ChipsProps) {
  return (
    <View style={styles.chipsBlock}>
      {label && <Text style={styles.chipsLabel}>{label}</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip label={allLabel} selected={value === null} onPress={() => onChange(null)} />
        {options.map((o) => (
          <Chip
            key={o.key}
            label={o.label}
            selected={value === o.key}
            onPress={() => onChange(o.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      hitSlop={4}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  panel: {
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.paper4,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  clearText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.red,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
  },
  searchText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '800',
    color: Colors.paper,
    letterSpacing: 0.5,
  },
  chipsBlock: { gap: Spacing.xs },
  chipsLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  chipsRow: {
    gap: Spacing.sm,
    paddingVertical: 2,
    paddingRight: Spacing.md,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 200,
  },
  chipSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  chipTextSelected: {
    color: Colors.paper,
  },
});
