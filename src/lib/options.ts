export const FRAME_FORMATS = ['jpeg', 'png', 'webp'] as const;

export type FrameFormat = (typeof FRAME_FORMATS)[number];

export const LIMITS = {
  maxFps: 60,
  minQuality: 0,
  maxQuality: 100,
} as const;

export const DEFAULT_MAX_RAW_FRAMES = 3000;
export const DEFAULT_MAX_DURATION_SEC = 30 * 60;
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_PROBE_TIMEOUT_MS = 30 * 1000;

type NumericRule = {
  expected: string;
  isValid: (value: number) => boolean;
};

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;
const isPositive = (value: number): boolean => value > 0;

const NUMERIC_RULES = {
  fps: {
    expected: `a number greater than 0 and at most ${LIMITS.maxFps}`,
    isValid: (value) => value > 0 && value <= LIMITS.maxFps,
  },
  maxFrames: { expected: 'a positive integer', isValid: isPositiveInteger },
  quality: {
    expected: `a number between ${LIMITS.minQuality} and ${LIMITS.maxQuality}`,
    isValid: (value) => value >= LIMITS.minQuality && value <= LIMITS.maxQuality,
  },
  maxRawFrames: { expected: 'a positive integer', isValid: isPositiveInteger },
  maxDurationSec: { expected: 'a positive number of seconds', isValid: isPositive },
  timeoutMs: { expected: 'a positive integer number of milliseconds', isValid: isPositiveInteger },
  probeTimeoutMs: {
    expected: 'a positive integer number of milliseconds',
    isValid: isPositiveInteger,
  },
} as const satisfies Record<string, NumericRule>;

type NumericOptionName = keyof typeof NUMERIC_RULES;

export type ValidatedOptions = Partial<Record<NumericOptionName, number>> & {
  format?: string;
};

const NUMERIC_OPTION_NAMES = Object.keys(NUMERIC_RULES).filter(
  (name): name is NumericOptionName => name in NUMERIC_RULES
);

function isValidNumber(rule: NumericRule, value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && rule.isValid(value);
}

function numericOptionError(name: NumericOptionName, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const rule: NumericRule = NUMERIC_RULES[name];
  if (isValidNumber(rule, value)) return undefined;
  return `Invalid ${name}: ${String(value)}. Expected ${rule.expected}.`;
}

function isFrameFormat(value: unknown): value is FrameFormat {
  return FRAME_FORMATS.some((format) => format === value);
}

function formatOptionError(value: unknown): string | undefined {
  if (value === undefined || isFrameFormat(value)) return undefined;
  return `Invalid format: ${String(value)}. Expected one of: ${FRAME_FORMATS.join(', ')}.`;
}

export function findOptionErrors(options: ValidatedOptions): string[] {
  const numericErrors = NUMERIC_OPTION_NAMES.map((name) => numericOptionError(name, options[name]));
  return [...numericErrors, formatOptionError(options.format)].filter(
    (error): error is string => error !== undefined
  );
}

export function assertValidOptions(options: ValidatedOptions): void {
  const errors = findOptionErrors(options);
  if (errors.length > 0) throw new Error(errors.join(' '));
}
