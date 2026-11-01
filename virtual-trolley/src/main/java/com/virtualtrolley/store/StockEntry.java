package com.virtualtrolley.store;

import com.virtualtrolley.domain.model.Product;

/** A product together with its opening stock level. */
public record StockEntry(Product product, int initialStock) {
}
