package com.virtualtrolley.domain.model;

import java.time.Instant;
import java.util.List;

/**
 * Immutable copy of a trolley's contents (Memento).
 * Safe to hand to the cashier thread while the trolley itself stays locked.
 */
public record CartSnapshot(int trolleyId, String barcode, List<CartLine> lines,
                           long totalCents, long totalGrams, Instant takenAt) {

    public CartSnapshot {
        lines = List.copyOf(lines); // defensive copy keeps the record truly immutable
    }

    public int itemCount() {
        return lines.stream().mapToInt(CartLine::quantity).sum();
    }
}
