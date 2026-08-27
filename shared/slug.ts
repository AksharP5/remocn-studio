const CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  ё: "e",
  є: "ye",
  і: "i",
  ї: "yi",
  ґ: "g",
};

const UNSAFE = /[^a-z0-9]+/g;
const EDGES = /^-+|-+$/g;

export const SLUG_FALLBACK = "video";

// A composition id travels into a folder name, a URL and Remotion's own
// registry, so it has to survive as `[a-z0-9-]`. Cyrillic is transliterated
// rather than stripped: a name written in Russian must not collapse to the
// fallback for every video in the project.
export function slugFor(name: string): string {
  const latin = [...name.toLowerCase()]
    .map((letter) => CYRILLIC[letter] ?? letter)
    .join("");

  const slug = latin.replace(UNSAFE, "-").replace(EDGES, "");

  return slug.length === 0 ? "" : slug;
}

export function freeSlug(
  wanted: string,
  taken: Iterable<string>,
  fallback = SLUG_FALLBACK
): string {
  const used = new Set(taken);
  const base = wanted.length === 0 ? fallback : wanted;

  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}
