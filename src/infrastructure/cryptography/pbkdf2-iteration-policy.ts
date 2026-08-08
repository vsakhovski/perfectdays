export interface Pbkdf2IterationPolicy {
  getIterations(): Promise<number>;
}

export interface Pbkdf2CalibrationOptions {
  /** Approximate time spent deriving a PIN key on this device. */
  readonly targetDurationMs?: number;
  /** Lower resource guardrail for exceptionally fast or imprecisely timed devices. */
  readonly minimumIterations?: number;
  /** Upper resource guardrail for slow devices and hostile timing implementations. */
  readonly maximumIterations?: number;
  /** Work used for the calibration sample before scaling to the target duration. */
  readonly sampleIterations?: number;
  readonly crypto?: Pick<Crypto, 'getRandomValues' | 'subtle'>;
  readonly now?: () => number;
}

const DEFAULT_TARGET_DURATION_MS = 250;
const DEFAULT_MINIMUM_ITERATIONS = 100_000;
const DEFAULT_MAXIMUM_ITERATIONS = 2_000_000;
const DEFAULT_SAMPLE_ITERATIONS = 20_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;
const ITERATION_ROUNDING_STEP = 1_000;

function requirePositiveFiniteNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }

  return value;
}

function requirePositiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }

  return value;
}

function resolveCrypto(
  providedCrypto: Pick<Crypto, 'getRandomValues' | 'subtle'> | undefined,
): Pick<Crypto, 'getRandomValues' | 'subtle'> {
  const resolvedCrypto = providedCrypto ?? (globalThis as { readonly crypto?: Crypto }).crypto;

  if (resolvedCrypto === undefined) {
    throw new Error('Web Crypto is unavailable.');
  }

  return resolvedCrypto;
}

async function measureIterations(
  webCrypto: Pick<Crypto, 'getRandomValues' | 'subtle'>,
  iterations: number,
  now: () => number,
): Promise<number> {
  const calibrationSecret = new TextEncoder().encode('perfect-days-pbkdf2-calibration');
  const salt = webCrypto.getRandomValues(new Uint8Array(SALT_BYTES));

  try {
    const keyMaterial = await webCrypto.subtle.importKey(
      'raw',
      calibrationSecret,
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const startedAt = now();

    await webCrypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations,
        salt,
      },
      keyMaterial,
      DERIVED_BITS,
    );

    return Math.max(now() - startedAt, Number.EPSILON);
  } finally {
    calibrationSecret.fill(0);
    salt.fill(0);
  }
}

/**
 * Creates a memoized, device-local PBKDF2 policy. The first call measures Web
 * Crypto and scales the measured work toward the configured target duration;
 * later calls reuse that result for the lifetime of the policy.
 */
export function createCalibratedPbkdf2IterationPolicy(
  options: Pbkdf2CalibrationOptions = {},
): Pbkdf2IterationPolicy {
  const targetDurationMs = requirePositiveFiniteNumber(
    options.targetDurationMs ?? DEFAULT_TARGET_DURATION_MS,
    'targetDurationMs',
  );
  const minimumIterations = requirePositiveSafeInteger(
    options.minimumIterations ?? DEFAULT_MINIMUM_ITERATIONS,
    'minimumIterations',
  );
  const maximumIterations = requirePositiveSafeInteger(
    options.maximumIterations ?? DEFAULT_MAXIMUM_ITERATIONS,
    'maximumIterations',
  );
  const sampleIterations = requirePositiveSafeInteger(
    options.sampleIterations ?? DEFAULT_SAMPLE_ITERATIONS,
    'sampleIterations',
  );

  if (minimumIterations > maximumIterations) {
    throw new RangeError('minimumIterations must not exceed maximumIterations.');
  }

  const webCrypto = resolveCrypto(options.crypto);
  const now = options.now ?? (() => performance.now());
  let pendingCalibration: Promise<number> | undefined;

  const calibrate = async (): Promise<number> => {
    const elapsedMs = await measureIterations(webCrypto, sampleIterations, now);
    const scaledIterations = (sampleIterations * targetDurationMs) / elapsedMs;
    const roundedIterations =
      Math.round(scaledIterations / ITERATION_ROUNDING_STEP) * ITERATION_ROUNDING_STEP;

    return Math.min(maximumIterations, Math.max(minimumIterations, roundedIterations));
  };

  return {
    getIterations() {
      pendingCalibration ??= calibrate().catch((error: unknown) => {
        pendingCalibration = undefined;
        throw error;
      });

      return pendingCalibration;
    },
  };
}
