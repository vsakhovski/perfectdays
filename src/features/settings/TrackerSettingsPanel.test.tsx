import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  TrackerSettingsPanel,
  type TrackerSettingsCopy,
  type TrackerSettingsValue,
} from './TrackerSettingsPanel';

const copy: TrackerSettingsCopy = {
  sectionLabel: 'Tracking preferences',
  title: 'Estimates and pre-period window',
  description: 'These settings change estimates, not recorded observations.',
  typicalCycleLength: 'Usual cycle length in days',
  typicalBleedDuration: 'Usual bleeding duration in days',
  orangeEnabled: 'Show possible pre-period days',
  orangeDays: 'Pre-period window length',
  forecastingPaused: 'Pause forecasts and predicted markers',
  optionalNumber: 'Optional whole number',
  positiveInteger: 'Enter a whole number greater than zero.',
  cycleRange: 'Choose from 1 to 365 days.',
  bleedRange: 'Choose from 1 to 90 days.',
  orangeRange: 'Choose from 1 to 14 days.',
  save: 'Save tracking preferences',
  saving: 'Saving preferences',
};

const initialValue: TrackerSettingsValue = {
  typicalCycleLength: 28,
  typicalBleedDuration: 5,
  orangeEnabled: true,
  orangeDays: 4,
  forecastingPaused: false,
};

function ControlledSettings({
  onSubmit,
}: {
  readonly onSubmit: (value: TrackerSettingsValue) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return <TrackerSettingsPanel copy={copy} onChange={setValue} onSubmit={onSubmit} value={value} />;
}

describe('TrackerSettingsPanel', () => {
  it('edits every preference as a controlled value and submits the result', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(value: TrackerSettingsValue) => void>();
    render(<ControlledSettings onSubmit={onSubmit} />);

    const cycleLength = screen.getByLabelText(copy.typicalCycleLength);
    const bleedDuration = screen.getByLabelText(copy.typicalBleedDuration);
    const orangeDays = screen.getByLabelText(copy.orangeDays);

    await user.clear(cycleLength);
    await user.type(cycleLength, '30');
    await user.clear(bleedDuration);
    await user.type(bleedDuration, '6');
    await user.clear(orangeDays);
    await user.type(orangeDays, '7');
    await user.click(screen.getByRole('checkbox', { name: copy.orangeEnabled }));
    await user.click(screen.getByRole('checkbox', { name: copy.forecastingPaused }));
    await user.click(screen.getByRole('button', { name: copy.save }));

    expect(onSubmit).toHaveBeenCalledWith({
      typicalCycleLength: 30,
      typicalBleedDuration: 6,
      orangeEnabled: false,
      orangeDays: 7,
      forecastingPaused: true,
    });
  });

  it('allows optional values to be cleared', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(value: TrackerSettingsValue) => void>();
    render(<ControlledSettings onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText(copy.typicalCycleLength));
    await user.clear(screen.getByLabelText(copy.typicalBleedDuration));
    await user.click(screen.getByRole('button', { name: copy.save }));

    expect(onSubmit).toHaveBeenCalledWith({
      orangeEnabled: true,
      orangeDays: 4,
      forecastingPaused: false,
    });
  });

  it('validates the numeric constraints and focuses the first invalid input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(value: TrackerSettingsValue) => void>();

    render(
      <TrackerSettingsPanel
        copy={copy}
        onChange={vi.fn<(value: TrackerSettingsValue) => void>()}
        onSubmit={onSubmit}
        value={{
          typicalCycleLength: 0,
          typicalBleedDuration: 4.5,
          orangeEnabled: true,
          orangeDays: 15,
          forecastingPaused: false,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: copy.save }));

    expect(screen.getByLabelText(copy.typicalCycleLength)).toHaveFocus();
    expect(screen.getByLabelText(copy.typicalCycleLength)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(copy.typicalBleedDuration)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(copy.orangeDays)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText(copy.positiveInteger)).toHaveLength(2);
    expect(screen.getAllByText(copy.orangeRange)).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects fallback values beyond the safe forecast limits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(value: TrackerSettingsValue) => void>();
    render(
      <TrackerSettingsPanel
        copy={copy}
        onChange={vi.fn<(value: TrackerSettingsValue) => void>()}
        onSubmit={onSubmit}
        value={{
          typicalCycleLength: 366,
          typicalBleedDuration: 91,
          orangeEnabled: true,
          orangeDays: 5,
          forecastingPaused: false,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: copy.save }));

    expect(screen.getByText(copy.cycleRange)).toBeVisible();
    expect(screen.getByText(copy.bleedRange)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exposes pending, status, and error states accessibly', () => {
    const onSubmit = vi.fn<(value: TrackerSettingsValue) => void>();
    render(
      <TrackerSettingsPanel
        busy
        copy={copy}
        errorMessage="Preferences could not be saved"
        onChange={vi.fn<(value: TrackerSettingsValue) => void>()}
        onSubmit={onSubmit}
        statusMessage="Previous preferences are still active"
        value={initialValue}
      />,
    );

    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: copy.saving })).toBeDisabled();
    expect(screen.getByLabelText(copy.typicalCycleLength)).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Preferences could not be saved');
    expect(screen.getByRole('status')).toHaveTextContent('Previous preferences are still active');
    fireEvent.submit(screen.getByRole('form', { name: copy.title }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('preserves an invalid empty orange value in the controlled draft until corrected', () => {
    const onChange = vi.fn<(value: TrackerSettingsValue) => void>();
    render(
      <TrackerSettingsPanel
        copy={copy}
        onChange={onChange}
        onSubmit={vi.fn<(value: TrackerSettingsValue) => void>()}
        value={initialValue}
      />,
    );

    fireEvent.change(screen.getByLabelText(copy.orangeDays), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ ...initialValue, orangeDays: Number.NaN });
  });
});
