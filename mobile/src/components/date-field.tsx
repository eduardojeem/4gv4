import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDay, isIsoDay, isoDay, monthGrid, MONTH_NAMES, shiftMonth, WEEKDAY_INITIALS, type IsoDay } from '../lib/calendar-model';
import { palette, usePalette } from '../lib/palette';

/**
 * Campo de fecha con un calendario que se abre debajo (sin modal, así funciona
 * también dentro de otra hoja). Guarda la fecha como AAAA-MM-DD y la muestra
 * como dd/mm/aaaa.
 */
export function DateField({ label, value, onChange, optional = false, disabled = false, today }: {
  label: string;
  value: IsoDay;
  onChange: (value: IsoDay) => void;
  optional?: boolean;
  disabled?: boolean;
  /** Hoy en la zona horaria del negocio, para resaltarlo y abrir en ese mes si no hay fecha. */
  today?: IsoDay;
}) {
  const colors = usePalette();
  const [open, setOpen] = useState(false);
  const base = isIsoDay(value) ? value : today && isIsoDay(today) ? today : isoDay(new Date().getFullYear(), new Date().getMonth(), 1);
  const [view, setView] = useState(() => ({ year: Number(base.slice(0, 4)), monthIndex: Number(base.slice(5, 7)) - 1 }));
  const toggle = () => {
    if (disabled) return;
    if (!open) setView({ year: Number(base.slice(0, 4)), monthIndex: Number(base.slice(5, 7)) - 1 });
    setOpen(!open);
  };
  const go = (delta: number) => setView(current => shiftMonth(current.year, current.monthIndex, delta));
  const pick = (day: number) => { onChange(isoDay(view.year, view.monthIndex, day)); setOpen(false); };

  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${isIsoDay(value) ? formatDay(value) : 'sin fecha'}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={toggle}
        style={[styles.input, { borderColor: open ? palette.primary : colors.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, color: isIsoDay(value) ? colors.text : colors.muted }}>{isIsoDay(value) ? formatDay(value) : 'Elegir fecha'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={[styles.calendar, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => go(-1)} hitSlop={10} style={styles.nav}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
            <Text style={{ color: colors.text, fontWeight: '700', textTransform: 'capitalize' }}>{MONTH_NAMES[view.monthIndex]} {view.year}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => go(1)} hitSlop={10} style={styles.nav}><Ionicons name="chevron-forward" size={20} color={colors.text} /></Pressable>
          </View>
          <View style={styles.week}>{WEEKDAY_INITIALS.map((day, index) => <Text key={index} style={[styles.cell, { color: colors.muted, fontSize: 12 }]}>{day}</Text>)}</View>
          {monthGrid(view.year, view.monthIndex).map((week, row) => (
            <View key={row} style={styles.week}>
              {week.map((day, index) => {
                if (day === null) return <View key={index} style={styles.cell} />;
                const iso = isoDay(view.year, view.monthIndex, day);
                const selected = iso === value, isToday = iso === today;
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={formatDay(iso)}
                    accessibilityState={{ selected }}
                    onPress={() => pick(day)}
                    style={[styles.cell, styles.day, selected && { backgroundColor: palette.primary }, !selected && isToday && { borderWidth: 1, borderColor: palette.primary }]}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontWeight: selected || isToday ? '700' : '400' }}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={styles.header}>
            {today ? <Pressable accessibilityRole="button" onPress={() => { onChange(today); setOpen(false); }}><Text style={{ color: palette.primary, fontWeight: '700' }}>Hoy</Text></Pressable> : <View />}
            {optional && value ? <Pressable accessibilityRole="button" onPress={() => { onChange(''); setOpen(false); }}><Text style={{ color: colors.muted, fontWeight: '600' }}>Quitar fecha</Text></Pressable> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  calendar: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, minHeight: 36 },
  nav: { padding: 6 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 38 },
  day: { borderRadius: 19, margin: 1 },
});
