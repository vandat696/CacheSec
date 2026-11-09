"use client";

import { useEffect, useRef } from "react";
import { expirationLabel, type QuotationRecord } from "./quotationModel";

export function QuotationDetails({ record }: { record: QuotationRecord }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [record.id]);
  return (
    <section className="quotation-details" aria-labelledby="quotation-detail-title" data-quotation-id={record.id}>
      <h2 id="quotation-detail-title" ref={heading} tabIndex={-1}>Chi tiết</h2>
      <dl>
        <div><dt>Mã</dt><dd>{record.id}</dd></div>
        <div><dt>Nhà cung cấp</dt><dd>{record.supplier_name || "(Trống)"}</dd></div>
        <div><dt>Mô tả</dt><dd>{record.description || "(Trống)"}</dd></div>
        <div><dt>Tổng tiền</dt><dd>{record.total_amount}</dd></div>
        <div><dt>Tiền tệ</dt><dd>{record.currency || "(Trống)"}</dd></div>
        <div><dt>Ngày hết hạn</dt><dd>{expirationLabel(record)}</dd></div>
      </dl>
      <details><summary>JSON</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
    </section>
  );
}
