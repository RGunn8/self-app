/** Join class names, skipping falsy values. */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Utility groups where a caller's class should replace a component default. Longest prefixes first.
const GROUPS = ['gap-x-', 'gap-y-', 'gap-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-', 'p-', 'rounded-', 'items-', 'justify-', 'bg-', 'h-', 'w-'];
const groupOf = (cls: string) => GROUPS.find((g) => cls.replace(/^-/, '').startsWith(g));

/**
 * Component defaults plus caller classes. A default is dropped when the caller sets the same utility,
 * because NativeWind resolves conflicts by stylesheet order, not by the order classes are written.
 */
export function withDefaults(defaults: string, className?: string) {
  if (!className) return defaults;
  const taken = new Set(className.split(/\s+/).map(groupOf).filter(Boolean));
  return cx(...defaults.split(' ').filter((d) => !taken.has(groupOf(d))), className);
}
