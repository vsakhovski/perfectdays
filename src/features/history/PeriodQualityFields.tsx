import { useTranslation } from 'react-i18next';
import { daysBetween } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';

export function PeriodQualityFields({
  startDate,
  endDate,
  others,
  approximate,
  onChange,
}: {
  readonly startDate: LocalDate;
  readonly endDate?: LocalDate;
  readonly others: readonly { startDate: LocalDate; endDate?: LocalDate }[];
  readonly approximate: boolean;
  readonly onChange: (approximate: boolean) => void;
}) {
  const { t } = useTranslation();
  const nearby = others.some((period) => {
    const before = period.endDate === undefined ? -1 : daysBetween(period.endDate, startDate) - 1;
    const after = endDate === undefined ? -1 : daysBetween(endDate, period.startDate) - 1;
    return (before >= 0 && before <= 2) || (after >= 0 && after <= 2);
  });
  return (
    <>
      {startDate === endDate ? <p role="status">{t(($) => $.intelligence.oneDay)}</p> : null}
      {nearby ? <p role="status">{t(($) => $.intelligence.nearby)}</p> : null}
      <label>
        <input
          type="checkbox"
          checked={approximate}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        {t(($) => $.intelligence.approximate)}
      </label>
    </>
  );
}
