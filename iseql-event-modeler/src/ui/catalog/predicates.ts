// src/ui/catalog/predicates.ts

export type PredicateCatalogEntry = {
  /** Stable id used in UI/store */
  id: string;
  /** Predicate name as it will appear in the model/output */
  name: string;
  /** Human-friendly label */
  label: string;
  /** Argument placeholders (MVP: strings) */
  argNames: string[];
};

export const PREDICATE_CATALOG: readonly PredicateCatalogEntry[] = [
  {
    id: "in",
    name: "in",
    label: "in(personId)",
    argNames: ["personId"],
  },
  {
    id: "hasPkg",
    name: "hasPkg",
    label: "hasPkg(personId, pkgId)",
    argNames: ["personId", "pkgId"],
  },
  {
    id: "insideCar",
    name: "insideCar",
    label: "insideCar(personId, carId)",
    argNames: ["personId", "carId"],
  },
] as const;

export function getPredicateEntry(nameOrId: string): PredicateCatalogEntry | undefined {
  return PREDICATE_CATALOG.find((p) => p.name === nameOrId || p.id === nameOrId);
}
