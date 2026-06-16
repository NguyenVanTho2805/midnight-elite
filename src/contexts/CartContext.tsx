"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  desc?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  hasItem: (id: string) => boolean;
  totalPrice: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);
const LS_KEY = "tsix_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  function save(next: CartItem[]) {
    setItems(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  function addItem(item: CartItem) {
    setItems((prev) => {
      if (prev.find((i) => i.id === item.id)) return prev;
      const next = [...prev, item];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeItem(id: string) {
    save(items.filter((i) => i.id !== id));
  }

  function clearCart() {
    save([]);
  }

  function hasItem(id: string) {
    return items.some((i) => i.id === id);
  }

  const totalPrice = items.reduce((s, i) => s + i.price, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, hasItem, totalPrice, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside <CartProvider>");
  return ctx;
}
