// Cyrillic is transliterated, and so are the Latin letters that carry no
// combining mark to strip: ß, ø, ł, đ, æ, œ, þ, ð and the dotless ı do not
// decompose under NFD, so without a row here each would fall to the hyphen.
const LETTERS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  ð: "d",
  ø: "o",
  þ: "th",
  đ: "d",
  ı: "i",
  ł: "l",
  œ: "oe",
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

// Every accent that is a combining mark once the string is decomposed — the
// acute on é, the tilde on ñ, the umlaut on ü — comes off here, so "Éclair"
// is `eclair` rather than `clair` and "Été" is `ete` rather than `t`. The
// table runs first: й and ё are one letter each in the table and two under
// NFD, and the breve and the diaeresis must not decide their spelling.
const MARKS = /\p{Mn}/gu;

const UNSAFE = /[^a-z0-9]+/g;
const EDGES = /^-+|-+$/g;

export const SLUG_FALLBACK = "video";

// A composition id travels into a folder name, a URL and Remotion's own
// registry, so it has to survive as `[a-z0-9-]`. Cyrillic is transliterated
// and accents are lifted rather than the letter being stripped: a name
// written in Russian, French or Turkish must not collapse to the fallback,
// and two names that differ only in accents must not collide.
export function slugFor(name: string): string {
  const latin = [...name.toLowerCase()]
    .map((letter) => LETTERS[letter] ?? letter)
    .join("")
    .normalize("NFD")
    .replace(MARKS, "");

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
