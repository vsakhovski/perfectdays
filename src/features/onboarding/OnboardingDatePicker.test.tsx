import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import { OnboardingDatePicker, type OnboardingDatePickerProps } from './OnboardingDatePicker';
import { inferredPickerDate } from './onboarding-date-picker-model';

const copy = {
  chooseDate: 'Choose date',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  calendarLabel: (field: string, month: string) => `Choose ${field}. ${month}`,
};

function Harness(props: Pick<OnboardingDatePickerProps, 'fieldKind' | 'label' | 'relatedDate'>) {
  const [value, setValue] = useState<OnboardingDatePickerProps['value']>('');
  return (
    <OnboardingDatePicker
      buttonRef={() => undefined}
      copy={copy}
      disabled={false}
      fieldKind={props.fieldKind}
      invalid={false}
      label={props.label}
      language="en"
      onChange={setValue}
      {...(props.relatedDate === undefined ? {} : { relatedDate: props.relatedDate })}
      value={value}
    />
  );
}

describe('OnboardingDatePicker', () => {
  it('infers a typical one-week interval from the related period boundary', () => {
    expect(
      inferredPickerDate('end', '', asLocalDate('2026-07-29'), asLocalDate('2026-01-01')),
    ).toBe('2026-08-04');
    expect(
      inferredPickerDate('start', '', asLocalDate('2026-08-03'), asLocalDate('2026-01-01')),
    ).toBe('2026-07-28');
    expect(
      inferredPickerDate(
        'start',
        asLocalDate('2026-05-12'),
        asLocalDate('2026-08-03'),
        asLocalDate('2026-01-01'),
      ),
    ).toBe('2026-05-12');
  });

  it('opens on the inferred month and closes from the trigger or outside backdrop', async () => {
    const user = userEvent.setup();
    render(<Harness fieldKind="end" label="End date" relatedDate={asLocalDate('2026-07-29')} />);

    const trigger = screen.getByRole('button', { name: /^End date$/ });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Choose End date. August 2026' })).toBeVisible();

    await user.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(trigger);
    const backdrop = screen.getByTestId('onboarding-date-picker-backdrop');
    fireEvent.pointerDown(backdrop);
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('selects a date and returns focus to the compact trigger', async () => {
    const user = userEvent.setup();
    render(
      <Harness fieldKind="start" label="Start date" relatedDate={asLocalDate('2026-08-03')} />,
    );

    const trigger = screen.getByRole('button', { name: /^Start date$/ });
    await user.click(trigger);
    await user.click(screen.getByRole('gridcell', { name: 'Tuesday, July 28, 2026' }));

    expect(trigger).toHaveTextContent('Jul 28, 2026');
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
