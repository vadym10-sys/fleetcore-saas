import { randomUUID } from "node:crypto";

export function envelope<T>(data: T) {
  return { data };
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function timestamp() {
  return new Date().toISOString();
}

