import { Button } from "@/components/ui/Button";
import { expirationLabel, type QuotationRecord } from "./quotationModel";

export function QuotationList({ items, busy, hasMore, unavailable, selectedId, onSelect, onMore, onRefresh }: {
  items: QuotationRecord[]; busy: boolean; hasMore: boolean; unavailable: boolean; selectedId?: string;
  onSelect: (id: string) => void; onMore: () => void; onRefresh: () => void;
}) {
  return (
    <section className="quotation-library" aria-labelledby="quotation-list-title" aria-busy={busy}>
      <div className="quotation-section-heading">
        <h2 id="quotation-list-title">Danh sách</h2>
        <Button variant="tertiary" id="quotation-refresh" disabled={busy} onClick={onRefresh}>Làm mới</Button>
      </div>
      {items.length === 0 ? <p className="quotation-empty" role="status">{busy ? "Đang tải…" : unavailable ? "Chưa tải được danh sách." : "Chưa có báo giá trong danh sách."}</p> : (
        <ul className="quotation-list" tabIndex={0} aria-label="Các báo giá">
          {items.map((record) => (
            <li key={record.id}>
              <button type="button" className="quotation-row" disabled={busy} aria-pressed={selectedId === record.id}
                onClick={() => onSelect(record.id)}>
                <strong>{record.supplier_name || "(Nhà cung cấp trống)"}</strong>
                <span className="quotation-money">{record.total_amount} {record.currency}</span>
                <span className="quotation-row-description">{record.description || "(Mô tả trống)"}</span>
                <span className="quotation-row-expiration">{expirationLabel(record)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasMore && <Button variant="secondary" id="quotation-more" disabled={busy} onClick={onMore}>Tải thêm</Button>}
    </section>
  );
}
