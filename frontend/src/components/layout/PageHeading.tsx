import type { ReactNode } from "react";

export function PageHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      {action}
    </header>
  );
}
