export type NavItem = { href: string; label: string; icon: string; badge?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/",           label: "Inicio",     icon: "⊞" },
  { href: "/alumnos",    label: "Alumnos",    icon: "◎" },
  { href: "/cobros",     label: "Cobros",     icon: "◈", badge: true },
  { href: "/asistencia", label: "Asistencia", icon: "◷" },
  { href: "/mas",        label: "Más",        icon: "≡" },
];

// Desktop-only for now: the CRM is a wide-screen workload and the bottom bar
// already carries the five tabs the phone flow depends on. Reachable on mobile
// from the "Más" menu.
export const CRM_NAV_ITEMS: NavItem[] = [
  { href: "/crm", label: "Chats", icon: "✉" },
];

export function isNavItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
