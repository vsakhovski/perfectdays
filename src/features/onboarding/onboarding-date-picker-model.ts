import { addDays } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';

function currentLocalDate(): LocalDate {
  const date = new Date();
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

export function inferredPickerDate(
  fieldKind: 'end' | 'start',
  value: LocalDate | '',
  relatedDate?: LocalDate,
  today: LocalDate = currentLocalDate(),
): LocalDate {
  if (value !== '') return value;
  if (relatedDate !== undefined) return addDays(relatedDate, fieldKind === 'end' ? 6 : -6);
  return today;
}
