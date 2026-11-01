package com.virtualtrolley.domain.model;

/** One product and its quantity inside a trolley. */
public record CartLine(Product product, int quantity) {

    public long lineTotalCents() {
        return product.priceCents() * quantity;
    }
}
