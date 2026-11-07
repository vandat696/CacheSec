"use client";
export type TableColumn<T> = {
  key: keyof T;
  label: string;
};
export function DataTable<T extends object>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
}) {
  return (
    <div
      className="nui nui-theme nui-table-wrap"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="nui-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column, columnIndex) =>
                  columnIndex === 0 ? (
                    <th key={String(column.key)} scope="row">
                      {String(row[column.key] ?? "—")}
                    </th>
                  ) : (
                    <td key={String(column.key)}>
                      {String(row[column.key] ?? "—")}
                    </td>
                  ),
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="nui-empty">
                Chưa có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
