import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../lib/useAuth";
import { isAdmin } from "../lib/admin";

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.7" r="0.2" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" />
    </svg>
  );
}

function NavItem({ to, label, icon, active }: { to: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <Link to={to} className={`bottom-nav-item${active ? " active" : ""}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function Header() {
  return (
    <header className="container header">
      <Logo />
    </header>
  );
}

/**
 * Shell mobile-first: header simples com a logo, conteúdo da página e uma
 * barra de navegação fixa no rodapé com 5 itens, espelhando o padrão da
 * referência (item ativo destacado em dourado, demais em cinza). Some em
 * telas largas (ver media query em theme.css).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    let active = true;
    isAdmin(user.id).then((v) => {
      if (active) setAdmin(v);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const path = location.pathname;
  const thirdItem = admin
    ? { to: "/admin", label: "Admin", icon: <IconFlag /> }
    : { to: "/como-funciona", label: "Como funciona", icon: <IconInfo /> };

  return (
    <>
      <Header />
      <div className="app-content">{children}</div>
      <nav className="bottom-nav">
        <NavItem to="/" label="Buscar" icon={<IconSearch />} active={path === "/"} />
        <NavItem to="/favoritos" label="Favoritos" icon={<IconHeart />} active={path.startsWith("/favoritos")} />
        <NavItem to={thirdItem.to} label={thirdItem.label} icon={thirdItem.icon} active={path.startsWith(thirdItem.to)} />
        <NavItem to="/painel" label="Painel" icon={<IconBriefcase />} active={path.startsWith("/painel")} />
        <NavItem
          to={user ? "/perfil" : "/login"}
          label="Perfil"
          icon={<IconUser />}
          active={path.startsWith("/perfil") || path === "/login"}
        />
      </nav>
    </>
  );
}
