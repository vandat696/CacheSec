"use client";

import { useEffect, useRef, useState } from "react";
import { QuotationApiError, QuotationHttpClient, quotationError } from "./quotationApi";
import type { QuotationCreate, QuotationRecord, QuotationValidation } from "./quotationModel";

const apiUrl = process.env.NEXT_PUBLIC_QUOTATION_API_URL ?? "http://127.0.0.1:8001";
type Busy = "connect" | "list" | "detail" | "create" | "validate" | null;
export type CreationResult = { saved: boolean; uncertain: boolean };

export function useQuotations() {
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState<QuotationRecord[]>([]);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<QuotationRecord | null>(null);
  const [validation, setValidation] = useState<QuotationValidation | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const client = useRef<QuotationHttpClient | null>(null);
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => { current.current?.abort(); client.current = null; }, []);

  function begin(operation: Busy) {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setBusy(operation); setError(""); setRequestId(undefined);
    return controller;
  }
  function active(controller: AbortController) {
    return current.current === controller && !controller.signal.aborted;
  }
  function clearData() { setItems([]); setCursor(null); setSelected(null); setValidation(null); }
  function disconnect() {
    current.current?.abort(); current.current = null; client.current = null;
    setConnected(false); setBusy(null); setError(""); setRequestId(undefined); clearData();
  }
  function failed(error: unknown, controller: AbortController) {
    if (!active(controller)) return;
    if (error instanceof QuotationApiError && error.status === 401) {
      client.current = null; setConnected(false); clearData();
    }
    setError(quotationError(error));
    setRequestId(error instanceof QuotationApiError ? error.requestId : undefined);
  }
  function finish(controller: AbortController) { if (active(controller)) setBusy(null); }

  async function connect(token: string) {
    const controller = begin("connect");
    setListUnavailable(false);
    clearData(); setConnected(false); client.current = null;
    const api = new QuotationHttpClient(apiUrl, token);
    try {
      const response = await api.list(controller.signal);
      if (!active(controller)) return;
      client.current = api; setConnected(true);
      setItems(response.data.items); setCursor(response.data.next_cursor);
      setRequestId(response.meta.request_id);
    } catch (error) { failed(error, controller); }
    finally { finish(controller); }
  }
  async function load(more = false) {
    const api = client.current;
    if (!api || (more && !cursor)) return;
    const controller = begin("list");
    setListUnavailable(false);
    if (!more) clearData();
    try {
      const response = await api.list(controller.signal, more ? cursor ?? undefined : undefined);
      if (!active(controller)) return;
      setItems((previous) => more
        ? [...new Map([...previous, ...response.data.items].map((item) => [item.id, item])).values()]
        : response.data.items);
      setCursor(response.data.next_cursor); setRequestId(response.meta.request_id);
    } catch (error) {
      if (active(controller)) setListUnavailable(true);
      failed(error, controller);
    }
    finally { finish(controller); }
  }
  async function select(id: string) {
    const api = client.current;
    if (!api) return;
    const controller = begin("detail"); setSelected(null); setValidation(null);
    try {
      const response = await api.get(id, controller.signal);
      if (!active(controller)) return;
      setSelected(response.data); setRequestId(response.meta.request_id);
    } catch (error) { failed(error, controller); }
    finally { finish(controller); }
  }
  async function create(data: QuotationCreate, key: string): Promise<CreationResult> {
    const api = client.current;
    if (!api) return { saved: false, uncertain: false };
    const controller = begin("create");
    setValidation(null);
    try {
      const response = await api.create(data, key, controller.signal);
      if (!active(controller)) return { saved: false, uncertain: true };
      setSelected(response.data); setRequestId(response.meta.request_id);
      // Creation is already committed. A failed refresh must not make the form resubmit it.
      try {
        const list = await api.list(controller.signal);
        if (active(controller)) { setItems(list.data.items); setCursor(list.data.next_cursor); setListUnavailable(false); }
      } catch (error) {
        if (active(controller)) setListUnavailable(true);
        failed(error, controller);
      }
      return { saved: true, uncertain: false };
    } catch (error) {
      failed(error, controller);
      return { saved: false, uncertain: !(error instanceof QuotationApiError) || error.status >= 500 };
    } finally { finish(controller); }
  }

  async function validate() {
    const api = client.current;
    if (!api || !selected) return;
    const controller = begin("validate");
    setValidation(null);
    try {
      const response = await api.validate(selected.id, controller.signal);
      if (!active(controller)) return;
      setValidation(response.data); setRequestId(response.meta.request_id);
    } catch (error) { failed(error, controller); }
    finally { finish(controller); }
  }

  return { connected, items, listUnavailable, cursor, selected, validation, busy, error, requestId, connect, disconnect, load, select, create, validate };
}
