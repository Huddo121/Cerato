// Type union
export type Union<A, B> = A & B;

// Type intersection
export type Intersect<A, B> = {
  [K in keyof A & keyof B]: A[K] extends B[K] ? A[K] : B[K];
};

// Left - properties that exist only in the first type
export type Left<A, B> = {
  [K in keyof A as K extends keyof B ? never : K]: A[K];
};

// Right type - properties that exist only in the second type
export type Right<A, B> = {
  [K in keyof B as K extends keyof A ? never : K]: B[K];
};

/** Keys that exist in `T`, and in type `U`, but not both */
export type Xor<A, B> = Union<Left<A, B>, Right<A, B>>;

export type EmptyRecord = Record<string, never>;

/**
 * Remove undefined and null from a type
 */
export type Defined<T> = Exclude<T, undefined | null>;

/** Utility type to convert a record in to a disjunction of tuples */
export type ToTuples<T> = { [K in keyof T]: [K, T[K]] }[keyof T];
export type ToDisjunctions<T extends Record<string, unknown>> = {
  [K in keyof T]: { [P in K]: T[P] };
}[keyof T];

/**
 * Utility type to disassemble an object in to its entries,
 *   maintaining the types of the pairs
 */
type EntriesOf<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export type AnEntryOf<T> = EntriesOf<T>[number];

/**
 * `Object.entries` but maintains the type of the keys and their associated values
 */
export const typedEntries = <T extends object>(record: T): EntriesOf<T> => {
  return Object.entries(record) as EntriesOf<T>;
};

export const typedKeys = <T extends Record<string, unknown>>(record: T): (keyof T)[] => {
  return Object.keys(record) as (keyof T)[];
};
