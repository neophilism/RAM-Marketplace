import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/research", label: "Research Needs" },
  { href: "/orders", label: "Orders" },
  { href: "/farm", label: "Farm Portal" },
  { href: "/vet", label: "Vet Review" },
  { href: "/ops", label: "RAM Ops" },
  { href: "/finance", label: "Finance" },
  { href: "/compliance", label: "Compliance" }
];

export function Nav() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brandMark">RAM</span>
        <span>Realistic Animal Models</span>
      </Link>
      <nav aria-label="Primary navigation">
        {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
      <Link className="ghostButton" href="/account">Account</Link>
    </header>
  );
}
