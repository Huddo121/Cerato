export type EmptyRecord = Record<string, never>;

/**
 * Collapses intersections (`A & B`, mapped-type unions) into a single object
 * type. Purely cosmetic to the compiler, but it makes hover output readable for
 * consumers and lets structural equality checks see a flat shape.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/** Utility type to convert a record in to a disjunction of tuples */
export type ToTuples<T> = { [K in keyof T]: readonly [K, T[K]] }[keyof T];

/**
 * Utility type to disassemble an object in to its entries,
 *   maintaining the types of the pairs
 */
type EntriesOf<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * `Object.entries` but maintains the type of the keys and their associated values
 */
export const typedEntries = <T extends object>(record: T): EntriesOf<T> => {
  return Object.entries(record) as EntriesOf<T>;
};
