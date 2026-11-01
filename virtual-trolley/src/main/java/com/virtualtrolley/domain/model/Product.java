package com.virtualtrolley.domain.model;

import java.util.Objects;

/**
 * Immutable catalogue item.
 * Price is held in cents and weight in grams to avoid floating-point drift.
 */
public record Product(int id, String name, long priceCents, long weightGrams) {

    public Product {
        Objects.requireNonNull(name, "name");
        if (priceCents < 0 || weightGrams < 0) {
            throw new IllegalArgumentException("price and weight must be >= 0");
        }
    }
}
