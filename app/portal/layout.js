// Portal nested layout: global CSS is already imported in the root layout;
// this file exists only to scope /portal under its own URL segment.

export default function PortalLayout({ children }) {
  return children;
}