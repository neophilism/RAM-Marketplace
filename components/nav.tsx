import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/marketplace", label: "Animal Marketplace" },
  { href: "/farm", label: "Farm Portal" },
  { href: "/ops", label: "RAM Operations" }
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
      <button className="ghostButton" type="button">Demo account</button>
    </header>
  );
}
