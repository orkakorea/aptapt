// src/pages/MapPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import MapChrome, { SelectedApt } from "../components/MapChrome";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

// ---------- Supabase ----------
function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", { url, hasKey: !!key });
    return null;
  }
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

// ---------- Kakao loader (HTTPS) ----------
function loadKakao(): Promise<any> {
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve(w.kakao);
  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim() ? envKey : FALLBACK_KAKAO_KEY;
  return new Promise((resolve, reject) => {
    const id = "kakao-maps-sdk";
    if (document.getElementById(id)) {
      const tryLoad = () => (w.kakao?.maps ? resolve(w.kakao) : setTimeout(tryLoad, 50));
      return tryLoad();
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    s.onload = () => {
      if (!w.kakao) return reject(new Error("kakao object not found"));
      w.kakao.maps.load(() => resolve(w.kakao));
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

// ---------- helpers ----------
function readQuery() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("q") || "").trim();
}
function writeQuery(v: string) {
  const u = new URL(window.location.href);
  if (v) u.searchParams.set("q", v);
  else u.searchParams.delete("q");
  window.history.replaceState(null, "", u.toString());
}

function toNumLoose(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
function getField(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

// ---------- types ----------
type PlaceRow = {
  id: number;
  단지명?: string | null;
  상품명?: string | null;
  주소?: string | null;
  geocode_status?: string | null;
  lat?: number | null;
  lng?: number | null;
};

// ---------- Spiderfy Controller ----------
type KMarker = any & { __baseKey?: string; __basePos?: any; __row?: PlaceRow };
class SpiderController {
  private map: any;
  private clusterer: any;
  private groups: Map<string, KMarker[]> = new Map();
  private activeKey: string | null = null;
  private activeLines: any[] = [];
  private animating = false;

  constructor(map: any, clusterer: any) {
    this.map = map;
    this.clusterer = clusterer;
  }

  setGroups(groups: Map<string, KMarker[]>) {
    this.groups = groups;
  }

  unspiderfy = () => {
    if (!this.activeKey) return;
    const markers = this.groups.get(this.activeKey) || [];
    // remove legs
    this.activeLines.forEach((ln) => ln.setMap(null));
    this.activeLines = [];
    // move back & return to clusterer
    markers.forEach((m) => {
      if (!m.__basePos) ret
