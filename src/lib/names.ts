const ADJECTIVES =
  'brave calm eager fuzzy gentle jolly lucky mellow nimble quiet rapid sunny witty zesty'.split(' ')
const ANIMALS =
  'otter heron lynx fox crane badger wren marten bison gecko ibis koala lemur yak'.split(' ')

// A service name doubles as a DNS label: lowercase letters, digits and hyphens, 63 characters max.
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '')
}

export function generateName(taken: ReadonlySet<string> = new Set(), random = Math.random): string {
  const pick = (words: string[]) => words[Math.floor(random() * words.length)] ?? words[0]
  const base = `whoami-${pick(ADJECTIVES)}-${pick(ANIMALS)}`
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`
  return name
}
