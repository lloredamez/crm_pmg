import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPhone(phone: string): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatCpf(cpf?: string | null): string {
  if (!cpf) return "-";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  return cpf;
}

export function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatCurrencyInput(val: string): string {
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  if (num === 0) return "";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrencyValue(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const str = String(val).trim();
  if (str.startsWith("R$") || str.includes(",")) {
    const digits = str.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    if (num === 0) return "";
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const parsed = parseFloat(str);
  if (!isNaN(parsed)) {
    return parsed.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return "";
}

export function parseCurrencyToNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (!str) return null;
  const digits = str.replace(/\D/g, "");
  if (!digits) return null;
  const num = parseInt(digits, 10) / 100;
  return isNaN(num) ? null : num;
}


